<script setup>
import { ref, onMounted } from 'vue';
import useAppState from './AppState';
import { useRouter } from 'vue-router';
import api from './api';

const state = useAppState();

onMounted(async () => {
    try
    {
        await api.post("/api/openSession");
        state.setAuthenticated(true);
    }
    catch
    {
    }
    state.setAppLoading(false);
});



</script>

<template>

    <div class="loading-form vh-100 d-flex align-items-center justify-content-center">
        
        <div class="text-center">

            <img src="/icon_dark_fine.svg" /><br/>
            <div class="spinner-border text-success" role="status"></div>

        </div>    
    </div>

</template>

<style>

.loading-form fieldset
{
    width: 360px;
}

.loading-form img
{
    width: 120px;
    height: auto;
}

</style>