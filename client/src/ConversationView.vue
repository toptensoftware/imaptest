<script setup>

import useAppState from './AppState';
import Utils from './Utils.js';
import EmailAddress from './EmailAddress.vue';
import AttachmentBlock from './AttachmentBlock.vue';

const state = useAppState();

</script>

<template>

    <div class="conversation-view" id="conversation-view">

        <h4 class="subject">{{state.loadedConversation?.subject}}</h4>

        <div class="message" v-for="m in state.loadedConversation?.messages" key="message_id">
            <div class="message-header">
                <div class="from"><EmailAddress :addr="m.from" /></div>
                <div class="date text-muted">{{ Utils.formatDateFromSecondsLong(m.date) }}</div>
                <div class="to text-muted">
                    <EmailAddress :addr="m.to" label="to" />
                    <EmailAddress :addr="m.cc" label=", cc:" />
                    <EmailAddress :addr="m.bcc" label=", bcc:" />
                </div>
            </div> 
            <div class="message-body" :class="{'color-reset': m.hasBackground || m.foreColors.length > 1}" v-html="m.html"></div>
            <div class="message-attachments" v-if="m.attachments.length > 0">
                <h6 class="mt-3" v-if="m.attachments.length == 1">1 Attachment</h6>
                <h6 class="mt-3" v-if="m.attachments.length > 1">{{m.attachments.length}} Attachments</h6>
                <AttachmentBlock :attachment="a" :message="m" v-for="a in m.attachments" />
            </div>
            <hr />
        </div>

        <pre v-if="true">{{JSON.stringify(state.loadedConversation, null, 4)}}</pre>
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