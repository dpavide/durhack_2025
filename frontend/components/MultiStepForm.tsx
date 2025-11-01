'use client';
import { useState } from 'react';

interface Participant {
  name: string;
  location: string;
}

export default function MultiStepForm() {
  const [step, setStep] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([{ name: '', location: '' }]);
  const [meetingType, setMeetingType] = useState('Informal');
  const [timeRange, setTimeRange] = useState('');

  const addParticipant = () => setParticipants([...participants, { name: '', location: '' }]);

  const handleChange = (index: number, field: keyof Participant, value: string) => {
    const updated = [...participants];
    updated[index][field] = value;
    setParticipants(updated);
  };

  const handleSubmit = async () => {
    const res = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants, meetingType, timeRange }),
    });
    const data = await res.json();
    console.log(data);
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white shadow-md p-6 rounded-2xl">
      <h2 className="text-2xl font-semibold text-indigo-600 mb-4">Step {step} of 3</h2>

      {step === 1 && (
        <div>
          {participants.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 mb-4">
              <input
                type="text"
                placeholder="Name"
                value={p.name}
                onChange={(e) => handleChange(i, 'name', e.target.value)}
                className="border p-2 rounded-md"
              />
              <input
                type="text"
                placeholder="City or postcode"
                value={p.location}
                onChange={(e) => handleChange(i, 'location', e.target.value)}
                className="border p-2 rounded-md"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addParticipant}
            className="text-indigo-600 underline mb-4"
          >
            + Add participant
          </button>
          <button
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl"
            onClick={() => setStep(2)}
          >
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <label>Meeting Type</label>
          <select
            value={meetingType}
            onChange={(e) => setMeetingType(e.target.value)}
            className="border p-2 rounded-md"
          >
            <option>Informal</option>
            <option>Formal</option>
          </select>
          <label>Preferred Time Range</label>
          <input
            type="text"
            placeholder="e.g. 2–4 PM"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border p-2 rounded-md"
          />
          <button
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl"
            onClick={() => setStep(3)}
          >
            Next
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <p className="mb-4">Review your details and generate your AI meeting plan.</p>
          <button
            onClick={handleSubmit}
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl"
          >
            Generate AI Plan
          </button>
        </div>
      )}
    </div>
  );
}
