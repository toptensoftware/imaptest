<script setup>

import useAppState from './AppState';
import { useRoute } from 'vue-router';

const state = useAppState();

</script>

<template>

    <div class="conversation-view" id="conversation-view">
        <pre>{{JSON.stringify(state.loadedConversation, null, 4)}}</pre>
    </div>

</template>

<style>

</style>