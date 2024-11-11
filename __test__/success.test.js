"use strict"

const add = (a, b) => a + b;

test('simple addition test', () => {
    expect(add(1, 2)).toBe(3); 
});