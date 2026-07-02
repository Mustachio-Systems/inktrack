/// <reference types="@cloudflare/workers-types" />
import type { Transaction } from './types/ledger';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // 🛡️ Strict CORS Headers for Dev Sandbox & Production Edge Security
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS Preflight Options Request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 🟢 ROUTE 1: GET /api/transactions (Fetch Ledger Feed)
      if (request.method === 'GET' && url.pathname === '/api/transactions') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM transactions ORDER BY timestamp DESC'
        ).all();
        
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // 🔵 ROUTE 2: POST /api/transactions (Commit New Entry)
      if (request.method === 'POST' && url.pathname === '/api/transactions') {
        const data = await request.json() as Transaction;
        
        // Data Integrity Assertions
        if (!data.id || !data.grossAmount || !data.incomeType || !data.paymentMethod) {
          return new Response(JSON.stringify({ error: 'Missing strict required transaction variables.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        await env.DB.prepare(
          `INSERT INTO transactions (id, timestamp, clientName, description, incomeType, paymentMethod, grossAmount, shopCutPercentage, netAmount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          data.id,
          data.timestamp,
          data.clientName || 'Anonymous Client',
          data.description || null,
          data.incomeType,
          data.paymentMethod,
          data.grossAmount,
          data.shopCutPercentage,
          data.netAmount
        ).run();

        return new Response(JSON.stringify({ success: true, id: data.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        });
      }

      // Fallback 404 Route
      return new Response(JSON.stringify({ error: 'Endpoint route context not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message || 'Internal Edge Runtime Exception' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  },
};