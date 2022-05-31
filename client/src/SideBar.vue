<script setup>

import useAppState from './AppState';
const state = useAppState();

</script>

<template>
    <!-- Side Bar-->
    <div id="side-bar">

        <button class="compose-button btn btn-outline-success">
            <span class="symbol">create</span> Compose
        </button>

        <div class="folder-list list-group" v-for="g in state.folderGroups" :key="g.group">
            <router-link :to="'/mail/' + f.name" class="list-group-item list-group-item-action" :class="{active: state.activeFolder == f.name}" v-for="f in g.items">
                <span>
                    <span class="symbol">{{ f.icon }}</span> 
                    {{ f.title }}
                </span>
                <span class="badge bg-info rounded-pill" v-if="f.unread">{{ f.unread }}</span>
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

