const express=require('express');

// Receipt files are stored only in the private payment-receipts bucket.
// Do not persist browser-provided/public receipt URLs on orders.
const originalPost=express.application.post;
express.application.post=function(routePath,...handlers){
  if(routePath==='/api/orders'){
    const sanitize=(req,res,next)=>{if(req.body&&typeof req.body==='object'){delete req.body.receipt_url;delete req.body.receiptUrl;delete req.body.payment_receipt_url}next()};
    return originalPost.call(this,routePath,sanitize,...handlers);
  }
  return originalPost.call(this,routePath,...handlers);
};
