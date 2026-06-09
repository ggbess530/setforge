import Anthropic from '@anthropic-ai/sdk'

// Singleton — one client instance reused across all requests
// The SDK reads ANTHROPIC_API_KEY from env automatically
const anthropic = new Anthropic()

export default anthropic

// Single source of truth for the model string.
// Update this one line when you want to upgrade models.
export const CLAUDE_MODEL = 'claude-sonnet-4-6'
