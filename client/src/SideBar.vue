<script setup>

import { computed } from 'vue';
import useAppState from './AppState';
import Utils from './Utils';
const state = useAppState();

let folder_class = {
    "\\Inbox": { group: "A", order: 0, icon: "inbox", title: "Inbox", },
    "\\Drafts": { group: "A", order: 1, icon: "draft", title: "Drafts" },
    "\\Snoozed": { group: "A", order: 2, icon: "snooze", title: "Snoozed" },
    "\\Sent": { group: "A", order: 3, icon: "send", title: "Sent" },
    "\\Archive": { group: "A", order: 4, icon: "archive", title: "Archive" },

    "\\Junk": { group: "C", order: 1, icon: "report", title: "Junk" },
    "\\Trash": { group: "C", order: 0, icon: "delete", title: "Trash" },
}

function getFolderGroup(folder)
{
    let fc = folder_class[folder.special_use_attrib];
    if (fc)
        return fc.group;
    else
        return "B";
}

function compareFolders(a, b)
{
    let fca = folder_class[a.special_use_attrib];
    let fcb = folder_class[b.special_use_attrib];
    if (fca && fcb)
        return fca.order - fcb.order;
    
    return Utils.compareStrings(a.name, b.name);
}

function getFolderIcon(folder)
{
    let fc = folder_class[folder.special_use_attrib];
    if (fc)
        return fc.icon;

    return "folder";
};

function getFolderTitle(folder)
{
    let fc = folder_class[folder.special_use_attrib];
    if (fc)
        return fc.title;

    return folder.name;
};

const groups = computed(() => {
    let gr = Utils.groupBy(state.folders, x=>getFolderGroup(x));
    gr.sort((a,b) => Utils.compareStrings(a.group, b.group));
    gr.forEach(x => x.items.sort(compareFolders));
    return gr;
});



</script>

<template>
    <!-- Side Bar-->
    <div id="side-bar">

        <button class="compose-button btn btn-outline-success">
            <span class="symbol">create</span> Compose
        </button>

        <div class="folder-list list-group" 
            v-for="g in groups" 
            :key="g"
            >

            <router-link 
                :to="'/mail/' + f.name" 
                class="list-group-item list-group-item-action" 
                :class="{active: state.routeFolder == f.name}" 
                v-for="f in g.items"
                :key="f.name"
                >

                <span>
                    <span class="symbol">{{ getFolderIcon(f) }}</span> 
                    {{ getFolderTitle(f) }}
                </span>

                <span class="badge bg-info rounded-pill" v-if="f.count_unread">{{ f.count_unread }}</span>

            </router-link>
        </div>
    </div>
</template>


<style>
#side-bar
{
    display:none;
    width: 300px;
    height: 100%;
    overflow-y: auto;
    padding: 0.5rem;
    z-index: 2;
    background-color:var(--bs-body-bg);
}

.compose-button > span
{
    display:block;
    position:absolute;
}

.folder-list .symbol
{
    display:inline-block;
    margin-left: -0.3em;
    padding-right: 0.3em;
}



#side-bar > *
{
    width: 100%;
}

/* break point for side bar disappearing */
@media screen and (min-width:48em) 
{
    #side-bar
    {
        display: block;
        width: 25%;
    }
}

@media screen and (max-width:48em) 
{
    body.sidebar-active #side-bar
    {
        position: absolute;
        display: block;
        left: 0;
    }

}

.compose-button
{
    margin: 1.5em 0;
}

.folder-list
{
    margin-top: 0;
    margin-bottom: 1em;
}

.folder-list a
{
    display:flex;
    align-items: center;
    justify-content: space-between;
}

</style>

