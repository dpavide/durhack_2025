export async function generatePlan(data: any) {
  try {
    const res = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err) {
    console.error('Error fetching plan:', err);
    return { error: 'Could not generate plan, please retry.' };
  }
}
