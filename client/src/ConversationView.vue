<script setup>

import useAppState from './AppState';
import { useRoute } from 'vue-router';

const state = useAppState();
const route = useRoute();

const conversation_id = route.params.conversation_id;

</script>

<template>

    <div class="conversation-view" id="conversation-view">
        <h2>This is conversation '{{conversation_id}}'</h2>
    </div>

</template>

<style>

</style>