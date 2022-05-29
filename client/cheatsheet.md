## Component (Options API)

```js
import OtherComponent from './OtherComponent.vue'

export default 
{
    // Component Registration for use in 
    // template as <OtherComponent />
    components: 
    {
        OtherComponent
    }

    // Data
    data() 
    {
        return {
            // Data fields go here
            titleClass: 'title'
        }
    },
    
    // Methods
    methods: 
    {
        increment() 
        {
        }
    },

    // Computed properties
    computed: 
    {
        computedProperty() { return calculate() }
    },

    // Public properties settable by hosting views settable via
    // attribute:   <ThisComponent :customProperty="value" /> 
    props: 
    {
        customProperty: String
    }

    // Emits
    // Fire with this.$emit('event1', 'arg1', 'arg2')
    // Receive with <ThisComponent @event1="function(a1, s2) { }" />
    emits:
    [
        'event1', 'event2'
    ],

    // Life cycle hooks
    // beforeCreate(), created(), beforeMount(), mounted(), 
    // beforeUpdate(), updated(), beforeUnmount(), nmounted(),
    mounted() 
    {
    },

    // Provides data to child components that accept
    // it via injection
    provide: 
    {
        myData: 'hello!'
    },

    // Injects data from parent provides
    inject: ['myData'],

    // Watchers
    watch: 
    {
        // See also this.$watch 

        // Simple
        propertyName(newValue) 
        {
            // Called when 'propertyName' changes
        },

        // Advanced
        propertyName : 
        {
            // force eager callback execution
            immediate: true,

            // fires on sub-object change (expensive)
            deep: true,

            // fire after DOM update instance of before
            flush: 'post'

            handler(newQuestion) 
            {
            },
        }
        

    },
}
```


## Component (Composition API)

```html
<script setup>

// reactive state
const count = ref(0)

// functions that mutate state and trigger updates
function increment() 
{
  count.value++
}

// lifecycle hooks
onMounted(() => {
  console.log(`The initial count is ${count.value}.`)
});

// props
const props = defineProps(['foo'])

// emits
const emit = defineEmits(['inFocus', 'submit'])

// provide
import { provide } from 'vue'
provide('myData', 'hello!')

// inject
import { inject } from 'vue'
const injectedValue = inject('myData')
const injectedValeu = inject('myData', 'defaultValue')

</script>
```html

## Declarative Rendering

```
{{ user.name }}
```


## Attribute Binding

```html
<div :id="dynamicId"></div>
```


## HTML Event Binding

```html
<button @click="increment">
```


## Model Bindings

Two way binding between component and input field:

```html
<input v-model="text">
```


## Conditional Rendering

```html
<h1 v-if="awesome">That's Awesome!</h1>
<h1 v-else-if="good">Cool</h1>
<h1 v-else>Meh</h1>
```


## List Rendering

Array

```html
<!-- Array Elements -->
<li v-for="item in items" :key="item.id">
<!-- With Index -->
<li v-for="(item, index) in items" :key="item.id">
```

JavaScript objects

```html
<!-- Value Only -->
<li v-for="value in myObject">
<!-- Value and Key --> 
<li v-for="(value, key) in myObject">
<!-- Value, Key and Index --> 
<li v-for="(value, key, index) in myObject">
```

Ranges

```html
<!-- One Based (1..10) -->
<li v-for="i in 10">
```

Multiple Elements with Templates

```html
<template v-for="item in items">
<li>{{ item }}</li>
<li>etc...</li>
</template>
```

## Template References

Element will be accessible in component as `this.$refs.thing`

```html
<p ref="thing">hello</p>
```


## Slots

For passing inner content to hosted components

```html
<ChildComp>
  This is some slot content!
</ChildComp>
```

Then in component:

```html
<!-- in child template -->
<slot />
<!-- or -->
<slot>fallback content</slot>
```


## Imperitive Watchers

```js
// Start watching
const unwatch = this.$watch('foo', callback);

//Stop watching
unwatch();
```

## Async Component Loading

```js
import { defineAsyncComponent } from 'vue'

const AsyncComp = defineAsyncComponent(() =>
  import('./components/MyComponent.vue')
)
```