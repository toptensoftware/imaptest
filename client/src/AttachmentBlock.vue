<script>
import { getClass, getClassWithColor } from 'file-icons-js';
import 'file-icons-js/css/style.css';

</script>
<script setup>

const props = defineProps(['message', 'attachment']);

const iconClass = getClass(props.attachment.filename);


let fileExtension;
let imageUrl;
if (props.attachment.type.startsWith('image/'))
{
    imageUrl = `/api/bodypart/${props.message.quid}/${props.attachment.partID}`;
}
else
{
    let lastDot = props.attachment.filename.lastIndexOf('.');
    fileExtension = lastDot >= 0 ? props.attachment.filename.substring(lastDot+1) : "";
}

</script>

<template>

<a class="attachment-block" :href="`/api/bodypart/${props.message.quid}/${props.attachment.partID}?dl=1`">
    <div class="attachment-fill text-secondary" :style="{'background-image':'url('+imageUrl+')'}">
        <div class="large-icon" v-if="iconClass && !imageUrl">
        <i :class="iconClass"></i>
        </div>
        <template v-else>{{fileExtension}}</template>
    </div>
    <!--img v-if="imageUrl" :src="imageUrl" /-->
    <div class="attachment-title mb-1">
        {{props.attachment.filename}}
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

/*
.attachment-block img
{
    object-fit: cover;
    max-width: 100%;
    height: auto;
}
*/

.large-icon
{
    transform:scale(4) translateY(-0.4rem);
}

.attachment-fill
{
    display: block;
    position: absolute;
    top: 0px;
    bottom: 0px;
    width: 100%;
    height: 100%;
    text-align: center;
    font-weight: bold;
    font-size: 32px;
    padding-top: 20px;
    text-transform: uppercase;

    background-repeat:no-repeat;
    background-position:center;
    background-size:cover;
}

.attachment-title
{
    display: block;
    position: absolute;
    bottom: 0px;
    width: 100%;
    text-align: center;
    line-break: anywhere;
    font-size: smaller;
    padding: 3px;
}

</style>