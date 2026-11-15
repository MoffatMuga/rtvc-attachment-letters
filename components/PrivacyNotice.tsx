/** Short data notice shown on the request form and the trainee profile. */
export default function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`${compact ? "text-xs" : "text-sm"} leading-relaxed text-slate-500`}>
      <strong className="font-semibold text-slate-600">Your data:</strong> Rangwe TVC collects your name, admission
      number, contacts and attachment details only to process your attachment, assign your assessor and keep college
      records. They are seen by the Industrial Liaison Office and your assigned assessor, and are not sold or shared
      outside the college, apart from contacting your firm where needed. We handle them under the Data Protection
      Act, 2019. To correct or delete your details, contact the ILO.
    </p>
  );
}
