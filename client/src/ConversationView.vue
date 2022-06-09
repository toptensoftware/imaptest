<script setup>

import useAppState from './AppState';
import Utils from './Utils.js';
import EmailAddress from './EmailAddress.vue';

const state = useAppState();

</script>

<template>

    <div class="conversation-view" id="conversation-view">

        <h4 class="subject">{{state.loadedConversation?.subject}}</h4>

        <div class="message" v-for="m in state.loadedConversation?.messages" key="message_id">
            <div class="message-header">
                <div class="from"><EmailAddress :addr="m.from" /></div>
                <div class="date text-muted">{{ Utils.formatDateFromSecondsLong(m.date) }}</div>
                <div class="to text-muted">to <EmailAddress :addr="m.to" /></div>
            </div> 
            <div class="message-body" :class="{'color-reset': m.hasColor}" v-html="m.html"></div>
            <hr />
        </div>

        <pre v-if="false">{{JSON.stringify(state.loadedConversation, null, 4)}}</pre>
    </div>

</template>

<style>

.color-reset
{
    background-color: #ffffff;
    color: #000000;
}
.color-reset a
{
    color: #00acff;
}

.color-reset a:hover
{
    color: #008acc
}

.message-header .from
{
    float: left;
    font-weight: bold;
}
.message-header .date
{
    float: right;
    font-size: smaller;
}
.message-header .to
{
    font-size: smaller;
    clear: both;
    margin-bottom: 5px;
}

</style>