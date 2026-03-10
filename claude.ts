import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ─────────────────────────────────────────────
// AI RECEPTIONIST CHATBOT
// ─────────────────────────────────────────────

export async function chatWithReceptionist(
  messages: { role: 'user' | 'assistant'; content: string }[],
  salonContext: {
    salonName: string
    services: { name: string; price: number; duration: number }[]
    cancellationPolicy: string
    location: string
  }
) {
  const systemPrompt = `You are a friendly, professional AI receptionist for ${salonContext.salonName}, a hair salon located at ${salonContext.location}.

Your job is to:
- Answer questions about services, pricing, and availability
- Help clients book appointments in a conversational way
- Explain the cancellation policy clearly
- Escalate to a human when you cannot help

Salon Services:
${salonContext.services.map(s => `- ${s.name}: $${s.price}, ${s.duration} minutes`).join('\n')}

Cancellation Policy: ${salonContext.cancellationPolicy}

Keep responses concise, warm, and professional. If a client wants to book, collect: service, preferred date/time, and stylist preference. 
If you cannot answer something, say "Let me connect you with our team for that question."`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ─────────────────────────────────────────────
// CANCELLATION RISK SCORING
// ─────────────────────────────────────────────

export async function scoreCancellationRisk(appointmentData: {
  clientCancellationHistory: number   // number of past cancellations
  clientNoShowHistory: number
  totalPastAppointments: number
  daysUntilAppointment: number
  isHighValue: boolean
  serviceType: string
  dayOfWeek: string
  timeOfDay: string
}) {
  const prompt = `Analyze the following appointment data and return a cancellation risk assessment as JSON only.

Data:
- Client past cancellations: ${appointmentData.clientCancellationHistory}
- Client past no-shows: ${appointmentData.clientNoShowHistory}
- Client total past appointments: ${appointmentData.totalPastAppointments}
- Days until appointment: ${appointmentData.daysUntilAppointment}
- High-value appointment: ${appointmentData.isHighValue}
- Service type: ${appointmentData.serviceType}
- Day of week: ${appointmentData.dayOfWeek}
- Time of day: ${appointmentData.timeOfDay}

Return ONLY this JSON structure:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "riskScore": 0-100,
  "factors": ["factor1", "factor2"],
  "recommendation": "string describing what action to take"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    return JSON.parse(text)
  } catch {
    return { riskLevel: 'LOW', riskScore: 0, factors: [], recommendation: '' }
  }
}

// ─────────────────────────────────────────────
// REVIEW SENTIMENT ANALYSIS
// ─────────────────────────────────────────────

export async function analyzeReviewSentiment(reviewText: string) {
  const prompt = `Analyze this hair salon review and return JSON only.

Review: "${reviewText}"

Return ONLY this JSON:
{
  "sentimentScore": 0.0-1.0,
  "tags": ["tag1", "tag2"],
  "summary": "one sentence summary"
}

Possible tags: punctuality, communication, color_quality, cut_quality, extension_quality, cleanliness, pricing, friendliness, results`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    return JSON.parse(text)
  } catch {
    return { sentimentScore: 0.5, tags: [], summary: '' }
  }
}

// ─────────────────────────────────────────────
// PRODUCT RECOMMENDATIONS
// ─────────────────────────────────────────────

export async function getProductRecommendations(
  servicesPerformed: string[],
  clientHairProfile: { length: string; type: string; colorHistory: string },
  availableProducts: { id: string; name: string; description: string }[]
) {
  const prompt = `A client just received the following salon services: ${servicesPerformed.join(', ')}.

Client hair profile:
- Length: ${clientHairProfile.length}
- Hair type: ${clientHairProfile.type}
- Color history: ${clientHairProfile.colorHistory}

Available retail products:
${availableProducts.map(p => `- ID: ${p.id}, Name: ${p.name}, Description: ${p.description}`).join('\n')}

Return ONLY a JSON array of up to 3 product recommendations:
[
  {
    "productId": "string",
    "reason": "one sentence explanation for the stylist to share with the client"
  }
]`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}
