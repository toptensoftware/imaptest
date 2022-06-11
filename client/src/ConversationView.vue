<script setup>

import { computed } from 'vue';
import useAppState from './AppState';
import Utils from './Utils.js';
import EmailAddress from './EmailAddress.vue';
import AttachmentBlock from './AttachmentBlock.vue';

const state = useAppState();

</script>

<script>

function resetColors(m)
{
    // If the message uses background colors then reset colors
    if (m.hasBackground)
        return true;
    
    // If the message doesn't have any foreground colors then we
    // can use the theme colors
    if (m.foreColors.length == 0)
        return false;

    // We might still be able to keep the theme colors if: all the used
    // fore colors are in contrast to  the current background color

    // Calculate background color luminance
    let bodyStyle = window.getComputedStyle(document.getElementsByTagName("body")[0], null);
    let backColor = Utils.parseRgbString(bodyStyle.backgroundColor);
    let backLum = Utils.luminance(...backColor);

    // Check all the used fore colors have enough contrast to keep the background color
    for (let c of m.foreColors)
    {
        let foreLum = Utils.luminance(...Utils.parseColor(c));
        let contrast = (Math.max(backLum, foreLum) + 0.05) / 
                        (Math.min(backLum, foreLum) + 0.05)
        if (contrast < 3)
            return true;
    }

    return false;
};

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
            <div class="message-body" :class="{'color-reset': resetColors(m)}" v-html="m.html"></div>
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
    --bs-body-color: #000000;
    --bs-secondary: #c0c0c0;
    --bs-primary: #808080;
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

details.quoted_reply summary::marker 
{ 
    content: ""; 
}

details.quoted_reply summary span
{
    font-family: Verdana, Geneva, sans-serif;
    font-size: 12px;
    margin-left: 2px;
    border-radius: 10px;
    padding-left:10px;
    padding-bottom:1px;
    padding-right:10px;
    color: var(--bs-body-color);
    background-color:var(--bs-secondary);
}

details.quoted_reply summary span:hover
{
    background-color:var(--bs-primary);
}

.message-body blockquote
{
    border-left: 2px solid var(--bs-primary);
    padding-left: 1ex;
    margin-left: 0.5ex;
}

</style>