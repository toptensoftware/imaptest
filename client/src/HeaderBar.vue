<script setup>

import useAppState from './AppState';
import { useRouter, useRoute } from 'vue-router';

const state = useAppState();
const router = useRouter();
const route = useRoute();

function navigateUp()
{
    let path = route.path;
    let lastPart = path.lastIndexOf('/');
    if (lastPart > 0)
        router.push(route.path.substring(0, lastPart));
}

</script>

<template>
    <!-- Header Area -->
    <header>
        <div id="title" @click="state.toggleShortName()">{{ state.display_name }}</div> 

        <div id="header-container">
            
            <button class="icon-button" id="toggle-sidebar-button" onclick="toggleSideBar()"><span class="symbol">menu</span></button>

            <button class="icon-button" v-if="state.mode == 'message'" @click="navigateUp()"><span class="symbol">arrow_back</span></button>

            <div class="dropdown" v-if="state.mode != 'message'">
                <button class="selection-dropdown icon-button dropdown-toggle" data-bs-toggle="dropdown" id="select_dropdown"><span class="symbol">indeterminate_check_box</span></button>
                <ul class="dropdown-menu" aria-labelledby="select_dropdown">
                    <li><a @click="state.select('all')" class="dropdown-item" href="#">All</a></li>
                    <li><a @click="state.select('none')" class="dropdown-item" href="#">None</a></li>
                    <li><a @click="state.select('read')" class="dropdown-item" href="#">Read</a></li>
                    <li><a @click="state.select('unread')" class="dropdown-item" href="#">Unread</a></li>
                    <li><a @click="state.select('important')" class="dropdown-item" href="#">Important</a></li>
                    <li><a @click="state.select('unimportant')" class="dropdown-item" href="#">Unimportant</a></li>
                </ul>
            </div>

            <div class="text-warning" v-if="state.mode == 'select'">
                <b>{{state.selected_count}}</b>
            </div>

            <div id="header-text" class="flex-grow-1" v-if="state.mode == 'select' || state.mode == 'message'">
                {{state.activeMessage?.subject}}
            </div>

            <input type="text" id="search-box" placeholder="search" class="form-control flex-grow-1" v-if="state.mode == 'normal'">

            <template v-if="state.mode == 'select' || state.mode == 'message'">
            <button class="icon-button"><span class="symbol">archive</span></button>
            <button class="icon-button" @click="state.deleteSelected()"><span class="symbol">delete</span></button>
            <button class="icon-button"><span class="symbol">mail</span></button>
            <button class="icon-button"><span class="symbol">snooze</span></button>
            </template>

            <button class="icon-button" @click="state.logout()"><span class="symbol">settings</span></button>
            <!--button class="icon-button" data-bs-toggle="modal" data-bs-target="#testModal"><span class="symbol">settings</span></button-->

        </div>
    </header>


    <!-- The Modal -->
    <div class="modal" id="testModal">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Modal title</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true"></span>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Modal body text goes here.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary">Save changes</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>

</template>



<style>

header
{
    position: fixed;
    top: 0;
    width: 100%;
    height: 3rem;
    z-index: 1;
    align-items: center;
    display: flex;
    background-color:var(--bs-dark);
    color: var(--bs-white);
}

header .icon-button
{
    color: var(--bs-white);
}

#title
{
    display:none;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;        
    padding: 0.5rem;
    width: 25%;
}

#header-container
{
    width: 100%;
    display:flex;
    padding: .4rem;
    flex-grow: 1;
    align-items: center;
}

.selection-dropdown
{
    margin-right: 0.5rem;
}


#search-box
{
    margin-right: .5rem;
}

#header-text
{
    margin-left: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;        
    white-space: nowrap;
}

.x-bar
{
    display:flex;
    align-items: center;
    justify-content: space-between;
}

.x-bar > *
{
    margin-right: 0.5rem;
}

.x-bar :last-child
{
    margin-right: 0rem;
}

/* break point for side bar disappearing */
@media screen and (min-width:48em) 
{
    #title
    {
        display: block;
        width: 25%;
    }

    #header-container
    {
        width: 75%;
    }

    #toggle-sidebar-button
    {
        display:none;
    }

}

</style>

