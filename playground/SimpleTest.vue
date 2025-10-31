<template>
  <div class="simple-test">
    <h2>Simple Test Component</h2>
    <p>Count: {{ count }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>

<script>
export default {
  name: 'SimpleTest',
  data() {
    return {
      count: 0
    }
  },
  methods: {
    increment() {
      this.count++
    }
  }
}
</script>

<style scoped>
.simple-test {
  padding: 20px;
  border: 1px solid #ccc;
  margin: 10px 0;
}

.simple-test h2 {
  color: #42b883;
}

.simple-test button {
  background: #42b883;
  color: white;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 4px;
}

.simple-test button:hover {
  background: #369870;
}
</style>