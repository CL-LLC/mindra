#!/usr/bin/env node
/**
 * Test script for OpenAI integration in Mindra
 * This script tests if OpenAI API is properly configured
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=');
    process.env[key.trim()] = value;
  }
});

const OpenAI = require('openai');

async function testOpenAIConnection() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-xxx') {
    console.error('❌ OPENAI_API_KEY is not configured or is a placeholder');
    console.error('Please add your actual OpenAI API key to .env file');
    process.exit(1);
  }

  console.log('🔑 Testing OpenAI connection...');

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello! Please respond with 'OpenAI connection successful' and nothing else." }
      ],
      max_tokens: 10,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    console.log('✅ OpenAI connection successful!');
    console.log('Response:', content);
    process.exit(0);

  } catch (error) {
    console.error('❌ OpenAI connection failed:', error.message);
    if (error.status === 401) {
      console.error('   This usually means the API key is invalid or not found.');
    }
    process.exit(1);
  }
}

testOpenAIConnection();
