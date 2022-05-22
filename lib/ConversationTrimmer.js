const MultiValueMap = require("./MultiValueMap");
const Database = require('./Database');
const GroupBuilder = require("./GroupBuilder");
const Utils = require("./Utils");


class ConversationTrimmer
{
    // Trim all conversations that are affected by new, deleted and modified (flagged) messages
    static async trimConversations(account)
    {
        // Get collections
        let mcoll = Database.db.collection(account.collection_name("messages"));
        let ccoll = Database.db.collection(account.collection_name("conversations"));

        console.log("Start trim");
        let start = Date.now();

        // First count the number of conversations
        let conversationCount = await ccoll.countDocuments({});

        console.log(` - ${conversationCount} conversations`);

        // If there are no conversations
        let r;
        let flagged_mids = new Set();
        if (conversationCount != 0)
        {
            // Get all added and deleted message ids
            let deleted_mids = new Set();
            let added_mids = new Set();
            await mcoll.find(
                { state: { $ne: 0 } },
                { projection: { _id: 0, message_id: 1, references: 1, state: 1}}
                ).forEach(x => {

                    if (x.state < 0)
                    {
                        deleted_mids.add(x.message_id);
                        x.references?.forEach(x => deleted_mids.add(x));
                    }
                    else if ((x.state & 1) != 0)
                    {
                        added_mids.add(x.message_id);
                        x.references?.forEach(x => added_mids.add(x));
                    }
                    else if ((x.state & 2) != 0)
                    {
                        flagged_mids.add(x.message_id);
                    }

                });

            console.log(` - ${deleted_mids.size} deleted message ids`);
            console.log(` - ${added_mids.size} added messages ids`);
            let oldCount = deleted_mids.size;

            // Trim out moved messages
            for (let mid of deleted_mids)
            {
                if (added_mids.has(mid))
                {
                    deleted_mids.delete(mid);
                    added_mids.delete(mid);
                }
            }

            if (oldCount != deleted_mids.size)
            {
                console.log(` - ignoring ${oldCount - deleted_mids.size} moved messages`);
            }

            // Ignore any message ids which still exist elsewhere
            if (deleted_mids.size > 0)
            {
                oldCount = deleted_mids.size;

                await Utils.batch_work(Array.from(affected_mids), 1000, async (batch) => {

                    await mcoll.find(
                        { state: { $ne: -1}, message_id: { $in: batch } },
                        { projection: { _id: 0, message_id: 1 } }
                    ).forEach(x => 
                        deleted_mids.delete(x.message_id)
                    );

                });

                if (oldCount != deleted_mids.size)
                {
                    console.log(` - ignoring ${oldCount - deleted_mids.size} deleted messages that still exist elsewhere`);
                }
            }

            // Get the final set of affected message ids
            let affected_mids = [...deleted_mids, ...added_mids];
            console.log(` - total affecting messages: ${affected_mids.length}`);
            if (affected_mids.length > 0)
            {
                // Find all affected conversations
                let affected_conversations = [];
                await Utils.batch_work(affected_mids, 1000, async (batch) => {

                    await ccoll.find(
                        { message_ids: { $in: batch } },
                        { projection: { _id: 1 } }                
                    ).forEach(x => affected_conversations.push(x));

                });

                console.log(` - deleting ${affected_conversations.length} affected conversations`);

                // Delete affected conversations
                Utils.batch_work(affected_conversations, 1000, async (batch) => {

                    await ccoll.deleteMany(
                        { _id: { $in: batch } }
                    );

                });
            }

            // Update conversation flags
            await Utils.batch_work([...flagged_mids], 1000, async (batch) => {

                let r = await ccoll.aggregate([

                    // Find conversations containing message id's that have changed
                    { $match: { message_ids: { $in: batch } } },

                    // Get the associated messages
                    { $lookup: { 
                        from: account.collection_name("messages"), 
                        localField: "message_ids",
                        foreignField: "message_id",
                        as: "messages",
                        }},
                    { $unwind: "$messages" },

                    // Only want the conversation id and the msssage flags
                    // and also save the old flags for later change test
                    { $project: { 
                        _id: 1, 
                        "old_flags": "$flags", 
                        "flags": "$messages.flags" 
                        }},

                    // Work out the new flags
                    { $group: { 
                        _id: "$_id",
                        old_flags: { $first: "$old_flags"},
                        flags: { $accumulator: { 
                            init: "function() { return 0; }",
                            accumulate: "function(state, flags) { return state | flags; }",
                            accumulateArgs: ["$flags"],
                            merge: "function(s1, s2) { return s1 | s2; }",
                            finalize: "function(state) { return state; }"
                            } }
                        }},

                    // Ignore conversations where the flags didn't change
                    { $match: {
                        $expr: { $ne: ["$flags", "$old_flags"] }
                        }},

                    // Just keep the fields that need to be merged into
                    // the conversation documents
                    { $project: { 
                        _id: 1, 
                        flags: 1
                        }},

                    // Make changes
                    { $merge: {
                        into: account.collection_name("conversations"),
                        on: '_id',
                        whenMatched: 'merge',
                        whenNotMatched: 'fail',
                        }}

                ]).toArray();

            });
        }

                    
        // Remove deleted messages
        r = await mcoll.deleteMany({ state: -1 });
        console.log(` - purging ${r.deletedCount} deleted messages`);

        // Mark all messages as clean
        r = await mcoll.updateMany(
            { state: { $ne: 0} },
            { $set: { state: 0 } }
        );
        console.log(` - cleaned ${r.modifiedCount} modified messages`);

        console.log(` - finished in ${Date.now() - start} ms`);
    }
}

module.exports = ConversationTrimmer;