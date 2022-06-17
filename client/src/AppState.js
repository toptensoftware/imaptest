import { defineStore } from 'pinia';
import api from './api';
import Utils from './Utils';
import { useRouter } from 'vue-router';

export default defineStore('appState', {

    state: () => 
    ({
        _mode: "starting",
        user: "huh@wah.com",
        folders: [],

        progress: { complete: 0, message: "Synchronizing" },
        
        routeFolder: null,
        loadedFolderName: null,
        conversations: [],
        
        routeConversationId: null,
        loadedConversationId: null,
        loadedConversation: null,
        sync_info: null,
    }),

    getters: 
    {
        // Get the current application mode
        // 'starting', 'loggedOut', 'conversation', 'select' or 'normal'
        mode: (state) => 
        {
            // Handle 'starting', 'loggedOut' etc...
            if (state._mode)
                return state._mode;

            // Viewing a conversation?
            if (state.routeConversationId)
                return 'conversation';

            // Selection in conversation list?
            if (Utils.any(state.conversations, x=> x.selected))
                return 'select';

            // Normal conversation list view
            return 'normal';
        },

        // Get the display name of the logged in user
        display_name: (state) => 
        {
            return state.user;
        },

        // Get a conversation with specified id
        getConversation: (state) => {
            return (conversation_id) => {
                return state.conversations.find(x => x.conversation_id == conversation_id);
            }
        },

        // Get the number of selected conversations
        selected_count: (state) =>
        {
            if (state.routeConversationId)
                return 1;
            else
                return state.conversations.reduce((acc, obj) => obj.selected ? acc + 1 : acc, 0);  
        },

        // Get the page title
        pageTitle: (state) => {
            
            let parts = [];
            switch (state.mode)
            {
                case 'starting':
                    parts.push("Loading");
                    break;

                case 'loggedOut':
                    parts.push("Login");
                    break;

                case 'conversation':
                    parts.push(state.loadedConversation?.subject);
                    break;

                default:
                    if (state.activeSearch)
                        parts.push("Search Results");
                    else
                    {
                        for (let f of state.folders)
                        {
                            if (f.name == state.routeFolder)
                            {
                                if (f.count_unread)
                                    parts.push(`(${f.count_unread}) ${f.name}`);
                                else
                                    parts.push(f.name);
                            }
                        }
                    }
        
                    parts.push(state.user);
                    break;
            }

            parts.push("Email Mockup");

            return parts.join(" - ");
        },
    },

    actions:
    {
        updatePageTitle()
        {
            document.title = this.pageTitle;
        },

        setMode(mode)
        {
            this._mode = mode;

            if (mode == 'loggedOut')
            {
                this.user = null;
                this.routeConversationId = null;
                this.loadedConversationId = null;
                this.loadedConversation = null;
            }

            this.updatePageTitle();
        },

        // Start the application - called from StartPage
        async start()
        {
            this.setMode("starting");
            this.progress = { complete: 0, message: "Synchronizing" };

            // Ping server to check if we have a login token
            // If this fails authError will be called and we'll transition
            // to the login page.
            let r = await api.get("/api/ping");

            this.user = r.user;

            // Wait for sync to complete
            await api.open_events();

            // Load the conversation list for what ever is on view
            let loadPromise = this.loadViewData();

            // Small delay to allow full progress bar
            await new Promise((resolve) => setTimeout(resolve, 500));

            await loadPromise;
            
            // If we get here the ping worked and we must be authorized
            this.setMode(null);
        },

        // Called from the login page on explicit user entered login
        async login(user, pass, persistent)
        {
            // Do the login
            await api.post("/api/login", {
                user, pass, persistent
            });

            // Start the app again
            this.start();
        },

        // Logout the current user
        async logout()
        {
            api.close_events();
            await api.post('/api/logout');
            this.setMode("loggedOut");
        },

        // Called from API on any authentication error.
        authError()
        {
            this.setMode("loggedOut");
        },

        onServerProgress(progress)
        {
            if (progress.message == "Ready")
                progress.message = "Loading...";
            this.progress = progress;
        },

        onServerDidSync(info)
        {
            if (this.sync_info != null)
                this.refresh();
            this.sync_info = info;
        },

        // Prod the server to resync now
        async refresh()
        {
            this.loadedConversation = null;
            this.loadedFolder = null;
            await this.loadViewData();
        },

        // Load conversation list for the currently selected folder
        async loadViewData()
        {
            // Don't load conversations if not logged in or still starting
            if (this._mode == 'loggedOut')
                return;

            if (this.routeConversationId)
            {
                // Do we already have it loaded?
                if (this.loadedConversationId != this.routeConversationId)
                {
                    // Clear current loaded state
                    this.loadedConversationId = null;

                    // Use a placeholder from the conversation list until the real conversation loaded
                    this.loadedConversation = this.conversations.find(x => x.conversation_id == this.routeConversationId);

                    this.updatePageTitle();

                    // Fetch it
                    let options = { 
                        conversation_id: this.routeConversationId
                    };
                    let r = await api.get("/api/conversation", options);

                    // Store loaded conversation (unless route changed in the meantime)
                    if (this.routeConversationId == options.conversation_id)
                    {
                        this.loadedConversationId = this.routeConversationId;
                        this.loadedConversation = r;
                    }

                    this.updatePageTitle();
                }
            }

            if (this.routeFolder != this.loadedFolder)
            {
                // Clear currently loaded folder
                this.loadedFolder = this.routeFolder;

                // Fetch
                let options = { 
                    mailbox: this.routeFolder 
                };
                let r = await api.get("/api/conversations_and_mailboxes", options);

                // Same folder still selected?
                if (this.routeFolder == options.mailbox)
                {
                    this.conversations.splice(0, this.conversations.length, ...r.conversations.conversations);
                    this.folders.splice(0, this.folders.length, ...r.mailboxes.mailboxes);
                }
            }

            this.updatePageTitle();
        },


        // Called when route entered... update current state information
        // and load conversation list if changed
        setRouteState(routeParams)
        {
            if (routeParams.folder)
                this.routeFolder = routeParams.folder;
            
            if (routeParams.q)
            {
                this.routeFolder = null;
                this.activeSearch = routeParams.q;
            }

            if (routeParams.conversation_id)
                this.routeConversationId = routeParams.conversation_id;
            else
                this.routeConversationId = null;

            this.updatePageTitle();

            this.loadViewData();
        },


        /*
        toggleConversationselected(id)
        {
            let msg = this.conversations.find(x => x.conversation_id == id);
            if (msg)
                msg.selected = !msg.selected;
        },

        toggleConversationImportant(id)
        {
            let msg = this.conversations.find(x => x.conversation_id == id);
            if (msg)
                msg.important = !msg.important;
        },

        toggleConversationUnread(id)
        {
            let msg = this.conversations.find(x => x.conversation_id == id);
            if (msg)
                msg.unread = !msg.unread;
        },

        deleteConversation(id)
        {
            this.conversations = this.conversations.filter(x => x.conversation_id != id);
        },

        deleteSelected()
        {
            this.conversations = this.conversations.filter(x => !x.selected);
        },

        select(kind)
        {
            let sel;
            switch (kind)
            {
                case "all": sel = (m) => true; break;
                case "none": sel = (m) => false; break;
                case "read": sel = (m) => !m.unread; break;
                case "unread": sel = (m) => m.unread; break;
                case "important": sel = (m) => m.important; break;
                case "unimportant": sel = (m) => !m.important; break;
            }

            for (let m of this.conversations)
            {
                m.selected = sel(m);
            }
        }
        */
    }

});
  
