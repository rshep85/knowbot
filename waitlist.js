// api/waitlist.js — Vercel Edge Function
// Keeps your Airtable token secret server-side

export const config = { runtime: 'edge' };

// Simple in-memory rate limiter (per IP, resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT = 3;        // max signups per IP
const RATE_WINDOW = 60_000;  // per 60 seconds

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - entry.start > RATE_WINDOW) {
    // Window expired — reset
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;

  rateLimitMap.set(ip, { count: entry.count + 1, start: entry.start });
  return false;
}

function corsHeaders(origin) {
  // In production, replace * with your actual domain e.g. https://knowbot.ai
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors = corsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const { email, source } = body;

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ error: 'A valid email address is required.' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Read secrets from environment variables (set in Vercel dashboard)
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE_NAME = 'Signups';

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.error('Missing Airtable environment variables');
    return new Response(
      JSON.stringify({ error: 'Server configuration error.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // Write to Airtable
  try {
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Email: email.toLowerCase().trim(),
            Source: source || 'Unknown',
            'Signed Up': new Date().toISOString(),
          },
        }),
      }
    );

    if (!airtableRes.ok) {
      const err = await airtableRes.json();
      // Handle duplicate email gracefully
      if (err?.error?.type === 'INVALID_VALUE_FOR_COLUMN') {
        return new Response(
          JSON.stringify({ success: true, message: 'Already on the list!' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(err?.error?.message || 'Airtable error');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Welcome to the waitlist!' }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Airtable write failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'Could not save your signup. Please try again.' }),
      { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}
