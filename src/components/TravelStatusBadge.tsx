interface TravelStatusBadgeProps {
  gender: 'Male' | 'Female' | null;
  className?: string;
  existingOccupants?: { males: number; females: number; couples: number } | null;
}

export default function TravelStatusBadge({
  gender,
  className = '',
  existingOccupants,
}: TravelStatusBadgeProps) {
  const getStatusConfig = () => {
    if (gender === 'Male') {
      return {
        label: 'Male',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300',
      };
    }
    if (gender === 'Female') {
      return {
        label: 'Female',
        bgColor: 'bg-pink-100',
        textColor: 'text-pink-800',
        borderColor: 'border-pink-300',
      };
    }

    return {
      label: 'Unknown',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      borderColor: 'border-gray-300',
    };
  };

  const getCompositionLabel = (): string | null => {
    if (!existingOccupants) return null;
    let males = existingOccupants.males || 0;
    let females = existingOccupants.females || 0;
    const couples = existingOccupants.couples || 0;

    // Add driver by gender
    if (gender === 'Male') males += 1;
    else if (gender === 'Female') females += 1;

    const parts: string[] = [];
    if (males > 0) parts.push(`${males}M`);
    if (females > 0) parts.push(`${females}F`);
    if (couples > 0) parts.push(`${couples}C`);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  const config = getStatusConfig();
  const compositionLabel = getCompositionLabel();

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      {compositionLabel || config.label}
    </span>
  );
}
