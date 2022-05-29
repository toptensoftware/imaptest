<script setup>

import useAppState from './AppState';
import { useRoute } from 'vue-router';

const state = useAppState();
const route = useRoute();

const message_id = route.params.message_id;

</script>

<template>

    <div class="message-view" id="message-view">
        <h2>This is message '{{message_id}}'</h2>
    </div>

</template>

<style>

</style>