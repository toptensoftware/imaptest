const Imap = require('node-imap');
const utils = require('./utils');
const jsonfile = require('jsonfile');
const { info } = require('console');
const inspect = require('util').inspect;

/**
 * Manages the local cache of a single mailbox on an IMAP server
 */
class Mailbox
{
    /**
     * Constructs a new Mailbox instance
     * @constructor
     * @param {User} user A reference to the owning User object
     * @param {string} name The name of the mailbox on the IMAP server
     */
    constructor(user, name)
    {
        this._user = user;
        this._name = name;
        this._data = null;
        this._box = null;
    }

    /**
     * The currently loaded collection of messages
     * @type {object[]}
     */
     get messages() { return this._data.messages }

    /**
     * The name of the storage file for this Mailbox
     */
    get storage() 
    {
        return `${this._user.storageBase}-${this.name}.json`;
    }
 
    /**
     * The name of the mailbox on the IMAP server
     */
    get name() { return this._name; }
 
 
    /**
     * Load the Mailbox's cache data (unless already loaded)
     * @async
     * @returns {Promise<void>}
     */
    async load()
    {
        // Load data from file
        if (this._data == null)
        {
            try
            {
                this._data = await jsonfile.readFile(this.storage);
            }
            catch (err) { /* don't care */}
        }

        // Create default (empty) data
        if (this._data == null)
        {
            this.clearAllData();
        }
    }

    /**
     * Saves the mailbox cache
     */
    async save()
    {
        await jsonfile.writeFile(this.storage, this._data, { spaces: 2 });
    }

    /**
     * Synchronise the local cache for the mailbox with the IMAP server
     * @async
     * @returns {Promise<void>}
     */
    async sync()
    {
        // Create default empty data?
        if (!this._data)
            this.clearAllData();

        // Open the box
        this._box = await new Promise((resolve, reject) => 
        {
            this.#imap.openBox(this._name, true, (err, box) => {
                if (err)
                {
                    reject(err);
                }
                else
                {
                    resolve(box);
                }
            });
        })

        console.log(`syncing ${this.name} ${this._box.messages.total} messages...`)

        // Track sync info
        this._sync_info = {
            added_messages: [],
            deleted_messages: [],
            flagged_messages: [],
            did_reload: false,
            sync_error: false,
        }

        let isDirty = false;

        // If uid validity has changed, clear everything
        if (this._box.uidvalidity != this._data.uidvalidity)
        {
            // Fetch everything
            await this.#fetchAll();
            isDirty = true;
        }
        else
        {
            // Fetch any new messages
            if (this._data.uidnext != this._box.uidnext)
            {
                await this.#fetch(`${this._data.highestuid + 1}:*`, true);
                this._data.uidnext = this._box.uidnext;
                isDirty = true;
            }

            // Are there any deleted messages?
            if (this._data.messages.length != this._box.messages.total)
            {
                await this.#trimDeletedMessages();
                isDirty = true;
            }

            // Any flags changed?
            if (this._data.highestmodseq < this._box.highestmodseq)
            {
                await this.#syncFlags();
                this._data.highestmodseq = this._box.highestmodseq;
                isDirty = true;
            }
        }

        // If there was a sync error then do a full reload
        if (this._sync_info.sync_error)
        {
            await this.#fetchAll();
            isDirty = true;
            this._sync_info.sync_error = false;
        }

        // Save changes
        if (isDirty)
        {
            await this.save();
        }

        // Notify changes
        if(this._sync_info.did_reload)
        {
            if (this._sync_info.did_reload)
                console.log("  - reloaded");
            this._sync_info.added_messages = null;
            this._sync_info.deleted_messages = null;
            this._sync_info.flagged_messages = null;
        }
        else
        {
            if (this._sync_info.added_messages.length != 0)
                console.log(`  - added:   ${this._sync_info.added_messages.length}`);
            if (this._sync_info.deleted_messages.length != 0)
                console.log(`  - deleted: ${this._sync_info.deleted_messages.length}`);
            if (this._sync_info.flagged_messages.length != 0)
                console.log(`  - flagged: ${this._sync_info.flagged_messages.length}`);
        }
        
        // Notify owning user
        this._user.on_mailbox_sync(this, this._sync_info);
        this._sync_info = null;

        //console.log(`Synced ${this.name}`)
        this._box = null;
    }

    /**
     * Gets the IMAP connection from the owning user connection
     * @private
     * @type {IMap}
     */
    get #imap() { return this._user._imap; }

    /**
     * Fetch a range of messages from the IMAP server and append them
     * to the current set of loaded messages
     * 
     * @param {string} range An IMAP range specifier
     * @param {boolean} is_uid_range If true, the range specifies UIDs instead of sequence numebrs
     * @returns {void}
     * @async
     */
    #fetch(range, is_uid_range)
    {
        return new Promise((resolve, reject) => {
        
            let src = is_uid_range ? this.#imap : this.#imap.seq;
            let fetch = src.fetch(range, {
                bodies: 'HEADER.FIELDS (DATE MESSAGE-ID REFERENCES IN-REPLY-TO)'
            });

            fetch.on('message', (fetch_msg, seqno) => {
                let msg_hdrs = {};
                let msg_attrs = {};
                fetch_msg.on('body', function(stream, info) 
                {
                    let buffer = "";
                    stream.on('data', (chunk) => {
                        let str = chunk.toString('utf8');
                        buffer += str;
                    });
                    stream.on('end', () => {
                        msg_hdrs = Imap.parseHeader(buffer);
                    });
                });
                fetch_msg.once('attributes', (attrs) => {
                    msg_attrs = attrs;
                })
                fetch_msg.once('end', () => {
                    // Create message entry
                    let m = {
                        date: msg_hdrs.date ? Math.floor(new Date(msg_hdrs.date[0]).getTime()/1000) : 0,
                        uid: msg_attrs.uid,
                        message_id: utils.clean_message_id(msg_hdrs),
                        references: utils.clean_references(msg_hdrs),
                    };
                    
                    if (msg_attrs.flags.indexOf('\\Seen') < 0)
                        m.unread = true;
                    if (msg_attrs.flags.indexOf('\\Flagged') >= 0)
                        m.important = true;

                    this._data.messages.push(m);

                    // Update the highest seen uid
                    if (m.uid > this._data.highestuid)
                        this._data.highestuid = m.uid;

                    // Track new messages (unless in reload)
                    if (!this._sync_info.did_reload)
                    {
                        this._sync_info.added_messages.push(m);
                    }
                });
            });

            fetch.once('error', reject);
            fetch.once('end', resolve);
        });
    }

    /**
     * Fetches all messages in the mailbox and resets all other meta data
     * @async
     * @returns {Promise<void>}
     */
    async #fetchAll()
    {
        this._sync_info.did_reload = true;

        this._data.uidvalidity = this._box.uidvalidity;
        this._data.highestmodseq = this._box.highestmodseq;
        this._data.highestuid = 0;
        this._data.uidnext = this._box.uidnext;
        this._data.messages = [];

        if (this._box.messages.total != 0)
        {
            await this.#fetch("1:*", false);
        }
    }

    /**
     * Trims deleted messages from the Mailbox by querying the IMAP server for all
     * current UIDs and removing any from our local cache that no longer exist
     * @async
     * @returns {Promise<void>}
     */
    async #trimDeletedMessages()
    {
        // Box completely emptied?
        if (this._box.messages.total == 0)
        {
            this._sync_info.deleted_messages = this._data.messages;
            this._data.messages = [];
            return;
        }

        // Use ESearch if supported
        let isESearch = this.#imap.serverSupports('ESEARCH');
        let search_fn = isESearch ? this.#imap.esearch : this.#imap.search;

        // Get all uids
        let uids = await new Promise((resolve, reject) => {
            search_fn.call(this.#imap, [ 'ALL' ], (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(isESearch ? result.all : result);
            });
        });

        // Trim messages
        let old_messages = this._data.messages;
        let new_messages = [];
        let iter = utils.iterate_uids(uids, isESearch);
        for (let idst=0; idst < old_messages.length; idst++)
        {
            // Matching uid?
            if (!iter.eof() && old_messages[idst].uid == iter.current())
            {
                new_messages.push(old_messages[idst]);
                iter.next();
            }
            else
            {
                // Deleted message
                this._sync_info.deleted_messages.push(old_messages[idst]);
            }
        }

        // If we finished iterating the uid list then
        // things look ok
        if (iter.eof())
        {
            // Store new messages array
            this._data.messages = new_messages;
            return;
        }

        // We didn't get to the end of the UID list so something has gone
        // awry.  Refresh everything.
        info.sync_error = true;
    }

    /**
     * Synchronizes modified flags from the server
     * @async
     * @returns {Promise<void>}
     */
    async #syncFlags()
    {
        return new Promise((resolve, reject) => {
        
            let fetch = this.#imap.fetch("1:*", { 
                modifiers: {
                    changedsince: this._data.highestmodseq 
                }
            });

            fetch.on('message', (fetch_msg, seqno) => {
                let msg_attrs = {};
                fetch_msg.once('attributes', (attrs) => {
                    msg_attrs = attrs;
                })
                fetch_msg.once('end', () => {

                    let m_index = this.findUID(msg_attrs.uid);
                    if (m_index !== undefined)
                    {
                        let m = this._data.messages[m_index];

                        // Track what changed
                        let info = {
                            message : m
                        };
                            
                        // Unread changed?
                        let unread = msg_attrs.flags.indexOf('\\Seen') < 0;
                        if (unread != !!m.unread)
                        {
                            if (unread)
                                m.unread = true;
                            else
                                delete m.unread;
                            info.unread_changed = true;
                        }

                        // Important changed?
                        let important = msg_attrs.flags.indexOf('\\Flagged') >= 0;
                        if (important != !!m.important)
                        {
                            if (important)
                                m.important = true;
                            else
                                delete m.important;
                            info.important_changed = true;
                        }

                        // Track it
                        if (info.unread_changed || info.important_changed)
                            this._sync_info.flagged_messages.push(info);
                    }
                });
            });

            fetch.once('error', reject);
            fetch.once('end', resolve);
        });
    }

    /**
     * Finds the index of a message with the specified UID
     * @param {Number} value the UID to search for
     * @param {Number} low optional low index to start from (useful when searching for sorted UIDs)
     * @returns {Number|undefined} the zero based index of the message with the matching UID
     */
    findUID(value, low) 
    {
        if (low === undefined)
            low = 0;

        let array = this._data.messages;
        if (array.length == 0)
            return;
        let high = array.length - 1;
    
        if (value < array[low] || value > array[high]) 
            return;
    
        while (high >= low) 
        {
            let mid = (high + low) >> 1;
            let midval = array[mid].uid;
            
            if (value == midval)
                return mid;

            if (value < midval)
                high = mid - 1;
            else
                low = mid + 1;
        }
    
        return;
    }

    /**
     * Clears all loaded cache data
     */
    clearAllData()
    {
        this._data = {
            name: this._name,
            uidvalidity: null,
            highestmodseq: null,
            highestuid: 0,
            uidnext: null,
            messages: []
        }
    }
}

module.exports = Mailbox;