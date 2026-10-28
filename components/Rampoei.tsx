// ดอกรำเพย: 5 กลีบบิดเวียนแบบดอกลั่นทมเล็ก สีเหลือง
export default function Rampoei({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          transform={`rotate(${i * 72})`}
          d="M0 -4 C 10 -12, 26 -30, 12 -46 C 2 -46, -10 -34, -6 -16 C -5 -10, -3 -6, 0 -4 Z"
          fill="var(--rampoei)"
          stroke="var(--rampoei-deep)"
          strokeWidth="1.2"
        />
      ))}
      <circle r="7" fill="var(--rampoei-deep)" />
      <circle r="3" fill="var(--rampoei)" />
    </svg>
  );
}
