<script setup>
import { ref, nextTick } from 'vue';
import useAppState from './AppState';
import { useRouter } from 'vue-router';
import api from './api';

const state = useAppState();
const router = useRouter();

const user = ref("");
const pass = ref("");
const persistent = ref(false);
const elPass = ref(null);
const loginFailed = ref(false);
const busy = ref(false);

async function onSubmit()
{
    busy.value = true;
    loginFailed.value = false;

    try
    {
        await state.login(user.value, pass.value, persistent.value);
    }
    catch (err)
    {
        busy.value = false;
        loginFailed.value = true;
        pass.value = "";
        nextTick(() => elPass.value.focus());
        return;
    }
}

</script>
<template>

    <div class="login-form vh-100 d-flex align-items-center justify-content-center">
        
        <form class="row">
            <fieldset :disabled="busy">

                <p class="text-center">
                <img src="/icon_dark_fine.svg" />
                </p>

                <div class="form-group">
                    <div class="input-group">
                    <span class="input-group-text"><i class="symbol">person_outline</i></span>
                    <input v-model="user" type="username" class="form-control" id="username" placeholder="Username" autofocus>
                    </div>
                </div>
                
                <div class="form-group mt-1">
                    <div class="input-group">
                        <span class="input-group-text"><i class="symbol">lock</i></span>
                        <input v-model="pass" ref="elPass" type="password" class="form-control" id="password" placeholder="Password">
                    </div>
                </div>

                <div class="form-check form-switch mt-3 mb-4">
                    <input v-model="persistent" class="form-check-input" type="checkbox" id="persistent-login">
                    <label class="form-check-label" for="flexSwitchCheckChecked">Trust this device and stay logged in</label>
                </div>
                
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-primary" @click="onSubmit">
                        <span v-if="busy" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <span v-else>Login</span>
                    </button>
                </div>            

                <p class="text-warning text-center mt-5" :class="{invisible: !loginFailed}">
                    Login failed.
                </p>

            </fieldset>
        </form>    
    </div>

</template>

<style>

.login-form fieldset
{
    width: 360px;
}

.login-form img
{
    width: 120px;
    height: auto;
}

.login-form i
{
    transform: translate(0, 0);
    font-size: 22px;
}

</style>