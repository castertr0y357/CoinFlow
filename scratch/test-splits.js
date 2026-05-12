
function calculateProportionalSplits(totalAmount, items) {
  const absTotal = Math.abs(totalAmount);
  const itemsSum = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  if (itemsSum <= 0) {
    const perItem = absTotal / (items.length || 1);
    return items.map(item => ({
      amount: totalAmount < 0 ? -perItem : perItem,
      memo: item.title
    }));
  }

  const ratio = absTotal / itemsSum;
  let currentSum = 0;
  
  const splits = items.map((item, index) => {
    let amount;
    if (index === items.length - 1) {
      amount = Math.round((absTotal - currentSum) * 100) / 100;
    } else {
      amount = Math.round((item.price * item.quantity * ratio) * 100) / 100;
      currentSum += amount;
    }
    
    return {
      amount: totalAmount < 0 ? -amount : amount,
      memo: item.title
    };
  });

  return splits;
}

// Test cases
const test1 = calculateProportionalSplits(-33.00, [
  { title: "Item 1", price: 10, quantity: 1 },
  { title: "Item 2", price: 20, quantity: 1 }
]);
console.log("Test 1 (-33.00, items 10, 20):", test1);
console.log("Sum:", test1.reduce((a, b) => a + b.amount, 0));

const test2 = calculateProportionalSplits(-10.00, [
  { title: "A", price: 3, quantity: 1 },
  { title: "B", price: 3, quantity: 1 },
  { title: "C", price: 3, quantity: 1 }
]);
console.log("Test 2 (-10.00, items 3, 3, 3):", test2);
console.log("Sum:", test2.reduce((a, b) => a + b.amount, 0));

const test3 = calculateProportionalSplits(-5.00, [
  { title: "Free", price: 0, quantity: 1 },
  { title: "Paid", price: 1, quantity: 1 }
]);
console.log("Test 3 (-5.00, items 0, 1):", test3);
console.log("Sum:", test3.reduce((a, b) => a + b.amount, 0));
