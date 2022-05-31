import { defineStore } from 'pinia';

export default defineStore('appState', {

    state: () => 
    ({
        sessionKey: null,
        user: "brad@rocketskeleton.com",
        use_short_name: false,
        activeFolder: null,
        activeMessageId: null,
        messages: [
            { message_id: "A", selected: false, important: false, participants: "John, Fred", date: "11:23am", subject: "Product Inquiry", unread: true },
            { message_id: "B", selected: false, important: true, participants: "Jenny, Brad", date: "9:25am", subject: "Let's have lunch", unread: true },
            { message_id: "C", selected: false, important: false, participants: "Mitch", date: "9:17am", subject: "Bug Report" },
            { message_id: "D", selected: false, important: false, participants: "NuGet Gallery", date: "8:07am", subject: "NuGet Package Published" },
            { message_id: "E", selected: false, important: false, participants: "Anthony", date: "May 27", subject: "Software NFR Request" },
            { message_id: "F", selected: false, important: false, participants: "Eric, Brad", date: "Apr 25", subject: "Feature suggestion for new version" },
            { message_id: "G", selected: false, important: false, participants: "npm", date: "Apr 28", subject: "Important information about your npm account" },
            { message_id: "H", selected: false, important: true, participants: "Brad, Jen", date: "Apr 26", subject: "Let's have a party like it's 1999" }
        ],
        folderGroups: [
            {
                group: "Main",
                items: [
                    { name: "inbox", icon: "inbox", title: "Inbox", unread: 2 },
                    { name: "snoozed", icon: "snooze", title: "Snoozed" },
                    { name: "drafts", icon: "draft", title: "Drafts" },
                    { name: "sent", icon: "send", title: "Sent" },
                    { name: "archive", icon: "archive", title: "Archive" },
                ]
            },
            {
                group: "Infrequent",
                items: [
                    { name: "trash", icon: "delete", title: "Trash" },
                    { name: "junk", icon: "report", title: "Junk" },
                ]
            }
        ]
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
            if (state.activeMessageId)
                return 1;
            else
                return state.messages.reduce((acc, obj) => obj.selected ? acc + 1 : acc, 0);  
        },
        authenticated: (state) => !!state.sessionKey,
        mode: (state) => 
        {
            if (state.activeMessageId)
                return "message";

            if (state.messages.reduce((acc, obj) => obj.selected ? acc + 1 : acc, 0) > 0)
                return "select";
            else
                return "normal";
        },
        activeMessage: (state) => {
            if (state.activeMessageId)
                return state.messages.find(x => x.message_id == state.activeMessageId);
            else
                return null;
        },
        pageTitle: (state) => {

            if (state.mode == "nouser")
                return "Login";

            let parts = [];
            if (state.activeMessage)
                parts.push(state.activeMessage.subject);
            
            else if (state.activeSearch)
                parts.push("Search Results");

            else
            {
                for (let g of state.folderGroups)
                {
                    for (let f of g.items)
                    {
                        if (f.name == state.activeFolder)
                        {
                            if (f.unread)
                                parts.push(`(${f.unread}) ${f.title}`);
                            else
                                parts.push(f.title);
                        }
                    }
                }
            }

            parts.push(state.user);
            return parts.join(" - ");
        },
    },

    actions:
    {
        login(user, password) 
        {
            this.sessionKey = "msk";
            this.$router.push("/mail");
        },
        logout()
        {
            this.sessionKey = null;  
            this.$router.push("/login");
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

            if (routeParams.message_id)
                this.activeMessageId = routeParams.message_id;
            else
                this.activeMessageId = null;
        },

        toggleShortName()
        {
            this.use_short_name = !this.use_short_name;
        },

        toggleMessageSelected(id)
        {
            let msg = this.messages.find(x => x.message_id == id);
            if (msg)
                msg.selected = !msg.selected;
        },

        toggleMessageImportant(id)
        {
            let msg = this.messages.find(x => x.message_id == id);
            if (msg)
                msg.important = !msg.important;
        },

        toggleMessageUnread(id)
        {
            let msg = this.messages.find(x => x.message_id == id);
            if (msg)
                msg.unread = !msg.unread;
        },

        deleteMessage(id)
        {
            this.messages = this.messages.filter(x => x.message_id != id);
        },

        deleteSelected()
        {
            this.messages = this.messages.filter(x => !x.selected);
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

            for (let m of this.messages)
            {
                m.selected = sel(m);
            }
        }
    }

});
  
