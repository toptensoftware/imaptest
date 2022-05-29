<script setup>

import useAppState from './AppState';
import { useRouter, useRoute } from 'vue-router';

const state = useAppState();
const router = useRouter();
const route = useRoute();

function message_id_from_event(event)
{
    return event.target.closest('.message-list-item').dataset.messageId;
}

function onAction(event, action)
{
    event.stopPropagation();

    let message_id = message_id_from_event(event);

    switch(action)
    {
        case "click":
            router.push(route.path + '/' + message_id);
            break;

        case "select":
            state.toggleMessageSelected(message_id);
            break;

        case "important":
            state.toggleMessageImportant(message_id);
            break;

        case "delete":
            state.deleteMessage(message_id);
            break;

        case "unread":
            state.toggleMessageUnread(message_id);
            break;

        default:
            alert(`${action}: ${message_id}`);
            break;
    }
}

</script>

<template>

    <div class="message-list" id="message-list">

        <div 
            v-for="message in state.messages" 
            :key="message.message_id"
            class="message-list-item" 
            :class="{unread: message.unread}" 
            :data-message-id="message.message_id"
            @click="onAction($event, 'click')"
            >
        
            <div class="flags">
                <button class="icon-button flag-selected" @click="onAction($event, 'select')">
                    <span v-if="message.selected" class="symbol">check_box</span>
                    <span v-else class="symbol">check_box_outline_blank</span>
                </button>
                <button class="icon-button flag-important" @click="onAction($event, 'important')">
                    <span v-if="message.important" class="symbol-filled" style="color:orange">label_important</span>
                    <span v-else class="symbol">label_important</span>
                </button>  
            </div>

            <div class="detail-container">

                <div class="participants">
                    {{ message.participants }}
                    <button class="icon-button alignment-hack" style="width:0px;overflow:hidden;padding-left:0;padding-right:0"><span class="symbol">archive</span></button>
                </div>

                <div class=subject>
                    {{ message.subject }}
                </div>

                <div class=date>
                    {{ message.date }}
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
.message-list-item
{
    border-bottom:1px solid #444;
    cursor: pointer;
    display: flex;
    justify-items: baseline;
}

.message-list-item .flags
{
    width: 48px;
    min-width: 48px;
    height: 48px;
}

.message-list-item .flag-selected .symbol
{
    font-size:30px;
}

.message-list-item .detail-container
{
    flex-grow: 1;
    display: flex;
    flex-wrap: wrap;    
    align-items: baseline;
    justify-items: baseline;
}

.message-list-item .alignment-hack
{
    display:none;
}

.message-list-item:hover button
{
    color: var(--bs-body-color);
}

.message-list-item:not(hover) button
{
    color: var(--bs-gray);
}

.message-list .unread
{
    font-weight: bold;
}

.message-list-item+:not(.unread)
{
    color: rgba(var(--bs-body-color-rgb), 0.6);
}

.message-list-item:hover
{
    color: var(--bs-body-color);
}


.message-list-item button
{
    padding: 0.2rem 0.4rem;
}

.message-list-item:hover
{
    background-color: rgba(0,0,0,0.1);
}

.message-list-item .participants
{
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.message-list-item .subject
{
    width: 100%;
    order: 3;
}

.message-list-item .actions
{
    display:none;
}

.message-list-item .flag-important
{
    display:none;
}

.message-list-item
{
    font-size:0.9rem;
}


@media screen and (min-width:576px)
{
    .message-list-item
    {
        font-size:unset;
    }

    .message-list-item .participants
    {
        flex-basis: 200px;
        flex-grow: unset;
    }
    .message-list-item .subject
    {
        flex-basis: 0px;
        flex-grow: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-left:.5em;
        order:unset;
    }
    .message-list-item .flag-important
    {
        display:inline-block;
    }        

    .message-list-item .flag-selected .symbol
    {
        font-size:19px;
    }
    .message-list-item .flags
    {
        width: 72px;
        min-width: 72px;
        height: unset;
    }
    
    .message-list-item:hover .actions
    {
        display:block;
    }
    
    .message-list-item:hover .date
    {
        display:none;
    }
    
    .message-list-item .alignment-hack
    {
        display:inline-block;
    }
    
                
}
</style>