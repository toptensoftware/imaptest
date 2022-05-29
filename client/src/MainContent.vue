<script>
import MessageList from "./MessageList.vue";

export default {
  components: {
    MessageList
  }
}
</script>


<template>
    <!-- Main Content Area -->
    <div id="main">

        <router-view></router-view>
        
    </div>

    <div id="occlude-main">
    </div>
</template>

<style>

#main
{
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 0.5rem;
}

#occlude-main
{
    position:fixed;
    top: 3rem;
    left: 0px;
    width: 100%;
    height: 100%;
    background-color: rgb(0,0,0,0.6);
    z-index: 1; 
    display: none;
}

/* break point for side bar disappearing */
@media screen and (min-width:48em) 
{
    #main
    {
        width: 75%;
    }
}

@media screen and (max-width:48em) 
{
    body.sidebar-active #occlude-main
    {
        display: block;
    }
}

</style>