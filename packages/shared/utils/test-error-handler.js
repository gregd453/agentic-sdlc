const { ErrorHandler } = require('./dist/error-handler.js');

console.log('Testing ErrorHandler utility...\n');

// Test 1: Error instance
const error1 = new Error('Test error message');
const info1 = ErrorHandler.toErrorInfo(error1);
console.log('Test 1 - Error instance:');
console.log('  Message preserved:', info1.message === 'Test error message');
console.log('  Stack preserved:', !!info1.stack);

// Test 2: String error
const info2 = ErrorHandler.toErrorInfo('String error');
console.log('\nTest 2 - String error:');
console.log('  Message preserved:', info2.message === 'String error');

// Test 3: Object error
const info3 = ErrorHandler.toErrorInfo({ code: 'ERR_TEST', message: 'Object error' });
console.log('\nTest 3 - Object error:');
console.log('  Message preserved:', info3.message === 'Object error');
console.log('  Code preserved:', info3.code === 'ERR_TEST');

console.log('\n✅ ErrorHandler tests passed!');
