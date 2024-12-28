const calculate = () => {
  let result = 1;
  for (let i = 0; i < 30_000; i++) {
    result *= (Math.pow(2, 32) - i) / Math.pow(2, 32);
    console.log("iteration: " + i + " probability: " + result * 100 + "%");
  }
  return result;
};

console.log(calculate());
