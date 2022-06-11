<script>
import { getClass, getClassWithColor } from 'file-icons-js';
import 'file-icons-js/css/style.css';
import Utils from './Utils';

</script>
<script setup>

const props = defineProps(['message', 'attachment']);

const iconClass = getClass(props.attachment.filename);


let fileExtension;
let imageUrl;
let havePreview = false;
if (props.attachment.type.startsWith('image/'))
{
    imageUrl = `/api/bodypart/${props.message.quid}/${props.attachment.partID}`;
    havePreview = true;
}
else
{
    let lastDot = props.attachment.filename.lastIndexOf('.');
    fileExtension = lastDot >= 0 ? props.attachment.filename.substring(lastDot+1) : "";
}

</script>

<template>

<a class="attachment-block" :href="`/api/bodypart/${props.message.quid}/${props.attachment.partID}?dl=1`">
    <div v-if="havePreview" class="attachment-fill" :style="{'background-image':'url('+imageUrl+')'}">
    </div>
    <div class="attachment-info" :class="{ 'hide-till-hover': havePreview }">
        <div class="attachment-info-background text-secondary">
            <div v-if="iconClass" class="large-icon" ><i :class="iconClass"></i></div>
            <span v-else>{{fileExtension}}</span>
        </div>
        <div class="attachment-info-foreground">
            <span class="attachment-size text-muted">{{Utils.niceBytes(props.attachment.size)}}</span>
            <span class="attachment-filename">{{props.attachment.filename}}</span>
        </div>
    </div>
</a>

</template>

<style>

.attachment-block
{
    display: inline-block;
    width: 180px;
    height: 120px;
    background: var(--bs-dark);
    margin-right: 10px;
    margin-bottom: 10px;
    border-radius: 5px;
    border: 1px solid var(--bs-secondary);
    justify-content: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.attachment-fill
{
    display: block;
    position: absolute;
    top: 0px;
    bottom: 0px;
    width: 100%;
    height: 100%;
    background-repeat:no-repeat;
    background-position:center;
    background-size:cover;
}

.attachment-info
{
    display: block;
    position: absolute;
    top: 0px;
    bottom: 0px;
    width: 100%;
    height: 100%;
}

.attachment-info-background
{
    position: absolute;
    top: 0px;
    bottom: 0px;
    width: 100%;
    height: 100%;

    font-weight: bold;
    font-size: 32px;
    text-transform: uppercase;
    background: var(--bs-dark);

    display: flex;
    justify-content: center;
    align-items: center;
}

.large-icon
{
    transform:scale(4) translateY(-0.4rem);
}


.attachment-info-foreground
{
    position: absolute;
    width: 100%;
    height: 100%;
    text-align: center;
    line-break: anywhere;
    font-size: smaller;
    padding: 3px;

    display: flex;
    justify-content: center;
    align-items: end;
}

.attachment-size
{
    display: block;
    position: absolute;
    left:3px;
    top:3px;
}

.attachment-block .hide-till-hover
{
    display:none;
}

.attachment-block:hover .hide-till-hover
{
    display:block;
}

</style>