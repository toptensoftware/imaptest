<script setup>

import useAppState from './AppState';
import { useRouter, useRoute } from 'vue-router';
import Utils from './Utils.js';

const state = useAppState();
const router = useRouter();
const route = useRoute();

function conversation_id_from_event(event)
{
    return event.target.closest('.conversation-list-item').dataset.conversationId;
}

function onAction(event, action)
{
    event.stopPropagation();

    let conversation_id = conversation_id_from_event(event);

    switch(action)
    {
        case "click":
            router.push(route.path + '/' + conversation_id);
            break;

        case "select":
            state.toggleConversationSelected(conversation_id);
            break;

        case "important":
            state.toggleConversationImportant(conversation_id);
            break;

        case "delete":
            state.deleteConversation(conversation_id);
            break;

        case "unread":
            state.toggleConversationUnread(conversation_id);
            break;

        default:
            alert(`${action}: ${conversation_id}`);
            break;
    }
}

</script>

<template>

    <div class="conversation-list" id="conversation-list">

        <div 
            v-for="conversation in state.conversations" 
            :key="conversation.conversation_id"
            class="conversation-list-item" 
            :class="{unread: (conversation.flags & 2)!=0, read: (conversation.flags & 2)==0}" 
            :data-conversation-id="conversation.conversation_id"
            @click="onAction($event, 'click')"
            >
        
            <div class="flags">
                <button class="icon-button flag-selected" @click="onAction($event, 'select')">
                    <span v-if="conversation.selected" class="symbol">check_box</span>
                    <span v-else class="symbol">check_box_outline_blank</span>
                </button>
                <button class="icon-button flag-important" @click="onAction($event, 'important')">
                    <span v-if="conversation.flags & 1" class="symbol-filled" style="color:orange">label_important</span>
                    <span v-else class="symbol">label_important</span>
                </button>  
            </div>

            <div class="detail-container">

                <div class="participants">
                    {{ conversation.participants }}
                    <button class="icon-button alignment-hack" style="width:0px;overflow:hidden;padding-left:0;padding-right:0"><span class="symbol">archive</span></button>
                </div>

                <div class=subject>
                    <div class="subject-text">
                        {{ conversation.subject }}
                    </div>
                </div>

                <div class=date>
                    {{ Utils.formatDateFromSeconds(conversation.date) }}
                </div>

                <div class="actions">
                    <button class="icon-button" @click="onAction($event, 'archive')"><span class="symbol">archive</span></button>
                    <button class="icon-button" @click="onAction($event, 'delete')"><span class="symbol">delete</span></button>
                    <button class="icon-button" @click="onAction($event, 'unread')"><span class="symbol">mail</span></button>
                    <button class="icon-button" @click="onAction($event, 'snooze')"><span class="symbol">snooze</span></button>  
                </div>

            </div>
        </div>
    </div>

</template>

<style>
.conversation-list-item
{
    border-bottom:1px solid #444;
    cursor: pointer;
    display: flex;
    justify-items: baseline;
}

.conversation-list-item .flags
{
    width: 48px;
    min-width: 48px;
    height: 48px;
}

.conversation-list-item .flag-selected .symbol
{
    font-size:30px;
}

.conversation-list-item .detail-container
{
    flex-grow: 1;
    display: flex;
    flex-wrap: wrap;    
    align-items: baseline;
    justify-items: baseline;
}

.conversation-list-item .alignment-hack
{
    display:none;
}

.conversation-list-item:hover button
{
    color: var(--bs-body-color);
}

.conversation-list-item:not(hover) button
{
    color: var(--bs-gray);
}

.conversation-list .unread
{
    font-weight: bold;
}

.conversation-list .read
{
    color: rgba(var(--bs-body-color-rgb), 0.6);
}

.conversation-list-item:hover
{
    color: var(--bs-body-color);
}


.conversation-list-item button
{
    padding: 0.2rem 0.4rem;
}

.conversation-list-item:hover
{
    background-color: rgba(0,0,0,0.1);
}

.conversation-list-item .participants
{
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.conversation-list-item .subject
{
    width: 100%;
    order: 3;
}

.conversation-list-item .date
{
    text-align: right;
}

.conversation-list-item .actions
{
    display:none;
}

.conversation-list-item .flag-important
{
    display:none;
}

.conversation-list-item
{
    font-size:0.9rem;
}


@media screen and (min-width:576px)
{
    .conversation-list-item
    {
        font-size:unset;
    }

    .conversation-list-item .participants
    {
        width: 200px;
        /*flex-basis: 200px;*/
        flex-grow: unset;
        padding-right:.5em;
    }
    .conversation-list-item .subject
    {
        flex-basis: 0;
        width: 0;
        flex-grow: 1;
        min-width: 0;
        order:unset;
    }

    .conversation-list-item .subject-text
    {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }


    .conversation-list-item .flag-important
    {
        display:inline-block;
    }        

    .conversation-list-item .flag-selected .symbol
    {
        font-size:19px;
    }
    .conversation-list-item .flags
    {
        width: 72px;
        min-width: 72px;
        height: unset;
    }
    
    .conversation-list-item:hover .actions
    {
        display:block;
    }
    
    .conversation-list-item .date
    {
        flex-basis: 100px;
    }
    
    .conversation-list-item:hover .date
    {
        display:none;
    }
    
    .conversation-list-item .alignment-hack
    {
        display:inline-block;
    }
    
                
}
</style>