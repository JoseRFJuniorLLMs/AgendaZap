import express from 'express';
import { resolve } from 'node:path';

const app=express();
app.use('/AgendaZap',express.static(resolve('public'),{index:'index.html',maxAge:0}));
app.listen(8793,'127.0.0.1');
