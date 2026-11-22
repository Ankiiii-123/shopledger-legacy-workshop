'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

var riceLine = {
  id: 1,
  name: 'Rice',
  sku: 'RICE-01',
  hsn: '1006',
  price: 100,
  qty: 1
};

test('invoice GST and total match what order pricing records', function () {
  var ledger = pricing.computeTotals([riceLine], 'WELCOME');
  var figures = invoice.computeInvoiceFigures({
    coupon: 'WELCOME',
    items: [riceLine]
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    gstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax
  }, {
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    cgst: ledger.cgst,
    sgst: ledger.sgst,
    total: ledger.total,
    gstPercent: ledger.lines[0].gstPercent,
    lineTax: ledger.lines[0].tax
  });
});

test('CURRENT BEHAVIOUR: order pricing uses HSN GST and discounts before tax', function () {
  var totals = pricing.computeTotals([riceLine], 'WELCOME');

  assert.equal(totals.subtotal, 100);
  assert.equal(totals.discount, 5);
  assert.equal(totals.taxable, 95);
  assert.equal(totals.tax, 4.75);
  assert.equal(totals.cgst, 2.38);
  assert.equal(totals.sgst, 2.37);
  assert.equal(totals.total, 99.75);
  assert.deepEqual(totals.lines[0], {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    gstPercent: 5,
    gross: 100,
    discount: 5,
    taxable: 95,
    tax: 4.75,
    net: 99.75
  });
});

test('invoice applies HSN GST and discounts before tax like order pricing', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: 'WELCOME',
    items: [riceLine]
  });

  assert.equal(figures.subtotal, 100);
  assert.equal(figures.tax, 4.75);
  assert.equal(figures.cgst, 2.38);
  assert.equal(figures.sgst, 2.37);
  assert.equal(figures.discount, 5);
  assert.equal(figures.total, 99.75);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 4.75);
});

test('invoice respects percentage coupon max discount', function () {
  var bulkRice = Object.assign({}, riceLine, { price: 2000 });
  var ledgerTotals = pricing.computeTotals([bulkRice], 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [bulkRice]
  });

  assert.equal(ledgerTotals.discount, 150);
  assert.equal(ledgerTotals.tax, 92.5);
  assert.equal(ledgerTotals.total, 1942.5);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.tax, 92.5);
  assert.equal(invoiceFigures.total, 1942.5);
});

test('invoice does not apply a percentage coupon below its order minimum', function () {
  var smallRice = Object.assign({}, riceLine, { price: 400 });
  var ledgerTotals = pricing.computeTotals([smallRice], 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [smallRice]
  });

  assert.equal(ledgerTotals.discount, 0);
  assert.equal(ledgerTotals.tax, 20);
  assert.equal(ledgerTotals.total, 420);
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.tax, 20);
  assert.equal(invoiceFigures.total, 420);
});

test('GST reconciliation reports matched invoice and ledger figures', function () {
  var order = {
    id: 1001,
    date: '22/11/2026',
    customer: 'Walk-in',
    coupon: 'WELCOME',
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    total: 99.75,
    items: [riceLine]
  };
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 4.75);
  assert.equal(result.rows[0].invoiceTax, 4.75);
  assert.equal(result.rows[0].invoiceDiscount, 5);
  assert.equal(result.rows[0].invoiceTotal, 99.75);
  assert.equal(result.rows[0].matched, true);
});
