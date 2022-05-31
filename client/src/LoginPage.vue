<script setup>
import useAppState from './AppState';
import { useRouter } from 'vue-router';

const state = useAppState();
const router = useRouter();

function onSubmit()
{
    state.login("blah", "blah");
}

</script>
<template>

    <div class="login-form vh-100 d-flex align-items-center justify-content-center">
        
        <form class="row">
            <fieldset>

                <p class="text-center">
                <img src="/icon_dark_fine.svg" />
                </p>

                <div class="form-group">
                    <div class="input-group">
                    <span class="input-group-text"><i class="symbol">person_outline</i></span>
                    <input type="username" class="form-control" id="username" placeholder="Username" autofocus>
                    </div>
                </div>
                
                <div class="form-group mt-1">
                    <div class="input-group">
                        <span class="input-group-text"><i class="symbol">lock</i></span>
                    <input type="password" class="form-control" id="password" placeholder="Password">
                    </div>
                </div>

                <div class="form-check form-switch mt-3 mb-4">
                    <input class="form-check-input" type="checkbox" id="persistent-login">
                    <label class="form-check-label" for="flexSwitchCheckChecked">Trust this device and stay logged in</label>
                </div>
                
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-primary" @click="onSubmit">Login</button>
                </div>            

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