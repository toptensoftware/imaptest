<script setup>
  import HeaderBar from './HeaderBar.vue';
  import SideBar from './SideBar.vue';
  import MainContent from './MainContent.vue';
  import FloatingComposeButton from './FloatingComposeButton.vue';
</script>

<template>

  <HeaderBar />

  <div id="main-container">

    <SideBar />
    <MainContent />
    <FloatingComposeButton />

  </div>

</template>

<style>

.hidden
{
    display: none !important;
}

.icon-button
{
    background: none;
    border: none;
    color: var(--bs-body-color);
    padding: .3em .5em;
    border-radius: .2em;
}

.icon-button:hover
{
    background: var(--bs-primary);
}

.icon-button:active
{
    opacity: 0.8;
}



#main-container
{
    width: 100%;
    height: calc(100vh - 3rem);
    position:fixed;
    top: 3rem;
    display:flex;
}

/* break point for side bar disappearing */
@media screen and (min-width:48em) 
{
    #floating-compose-button
    {
        display:none;
    }
}


.symbol {
    font-family: "Material Symbols Outlined";
    font-weight: normal;
    font-style: normal;
    font-size: 19px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings: "liga";
    transform: translate(0, .18em);
}
.symbol-filled {
    font-family: "Material Symbols Outlined";
    font-weight: normal;
    font-style: normal;
    font-size: 19px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings: "liga";
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48;
    transform: translate(0, .18em);
}



</style>