import { defineStore } from 'pinia';
import api from './api';
import Utils from './Utils';

export default defineStore('appState', {

    state: () => 
    ({
        appLoading: true,
        authenticated: false,
        user: "brad@rocketskeleton.com",
        use_short_name: false,
        activeFolder: null,
        activeConversationId: null,
        /*
        conversations: [
            { conversation_id: "A", selected: false, important: false, participants: "John, Fred", date: "11:23am", subject: "Product Inquiry", unread: true },
            { conversation_id: "B", selected: false, important: true, participants: "Jenny, Brad", date: "9:25am", subject: "Let's have lunch", unread: true },
            { conversation_id: "C", selected: false, important: false, participants: "Mitch", date: "9:17am", subject: "Bug Report" },
            { conversation_id: "D", selected: false, important: false, participants: "NuGet Gallery", date: "8:07am", subject: "NuGet Package Published" },
            { conversation_id: "E", selected: false, important: false, participants: "Anthony", date: "May 27", subject: "Software NFR Request" },
            { conversation_id: "F", selected: false, important: false, participants: "Eric, Brad", date: "Apr 25", subject: "Feature suggestion for new version" },
            { conversation_id: "G", selected: false, important: false, participants: "npm", date: "Apr 28", subject: "Important information about your npm account" },
            { conversation_id: "H", selected: false, important: true, participants: "Brad, Jen", date: "Apr 26", subject: "Let's have a party like it's 1999" }
        ],
        */
        conversations: [],
        folders: [],
    }),

    getters: 
    {
        display_name: (state) => 
        {
            if (state.use_short_name)
            {
                let atpos = state.user.indexOf('@');
                if (atpos < 0)
                    return state.user;
                return state.user.substring(0, atpos);
            }
            else
                return state.user;
        },
        selected_count: (state) =>
        {
            if (state.activeConversationId)
                return 1;
            else
                return state.conversations.reduce((acc, obj) => obj.selected ? acc + 1 : acc, 0);  
        },
        mode: (state) => 
        {
            if (state.appLoading)
                return "appLoading";
            if (!state.authenticated)
                return "noauth";
            if (state.activeConversationId)
                return "conversation";

            if (state.conversations.reduce((acc, obj) => obj.selected ? acc + 1 : acc, 0) > 0)
                return "select";
            else
                return "normal";
        },
        activeConversation: (state) => {
            if (state.activeConversationId)
                return state.conversations.find(x => x.conversation_id == state.activeConversationId);
            else
                return null;
        },
        pageTitle: (state) => {

            if (!state.authenticated)
                return "Login";

            let parts = [];
            if (state.activeConversation)
                parts.push(state.activeConversation.subject);
            
            else if (state.activeSearch)
                parts.push("Search Results");

            else
            {
                for (let f of state.folders)
                {
                    if (f.name == state.activeFolder)
                    {
                        if (f.count_unread)
                            parts.push(`(${f.count_unread}) ${f.name}`);
                        else
                            parts.push(f.name);
                    }
                }
            }

            parts.push(state.user);
            return parts.join(" - ");
        },
    },

    actions:
    {
        async start()
        {
            await this.loadConversationList();
            this.authenticated = true;
            this.appLoading = false;
            document.title = this.pageTitle;
        },

        authError()
        {
            this.authenticated = false;
            this.appLoading = false;
            document.title = this.pageTitle;
        },

        async loadConversationList()
        {
            // Load folders
            let r = await api.get("/api/folders");
            this.folders.splice(0, this.folders.length, ...r.mailboxes);

            // Load conversations
            r = await api.get("/api/conversations", { mailbox: this.activeFolder } );
            this.conversations.splice(0, this.conversations.length, ...r.conversations);
        },

        async refresh()
        {
            await api.post("/api/sync");
            this.loadConversationList();
        },

        logout()
        {
            try
            {
                api.post('/api/logout');
            }
            catch { /* don't care */ }
            this.authenticated = false;
        },
        setRouteState(routeParams)
        {
            if (routeParams.folder)
                this.activeFolder = routeParams.folder;
            
            if (routeParams.q)
            {
                this.activeFolder = null;
                this.activeSearch = routeParams.q;
            }

            if (routeParams.conversation_id)
                this.activeConversationId = routeParams.conversation_id;
            else
                this.activeConversationId = null;

            document.title = this.pageTitle;
            //this.conversations.splice(0, this.conversations.length, []);
            this.loadConversationList();
        },

        toggleShortName()
        {
            this.use_short_name = !this.use_short_name;
        },

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
    }

});
  
