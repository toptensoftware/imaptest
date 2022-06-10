<script setup>
import { ref, onMounted } from 'vue';
import useAppState from './AppState';
import { useRouter } from 'vue-router';
import api from './api';

const state = useAppState();

onMounted(async () => {
    try
    {
        state.start();
    }
    catch
    {
    }
});



</script>

<template>

    <div class="loading-form vh-100 d-flex align-items-center justify-content-center">
        
        <div class="text-center">

            <img src="/icon_dark_fine.svg" /><br/>
            <div class="progress mt-3 mb-2" style="width: 300px">
                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" :aria-valuenow="state.progress.complete" aria-valuemin="0" aria-valuemax="100" :style="{ width: state.progress.complete + '%' }"></div>
            </div>
            <div>{{state.progress.message}}</div>

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