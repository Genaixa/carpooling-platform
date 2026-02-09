interface TravelStatusBadgeProps {
  travelStatus: 'solo' | 'couple';
  gender: 'Male' | 'Female' | null;
  partnerName?: string | null;
  className?: string;
}

export default function TravelStatusBadge({
  travelStatus,
  gender,
  partnerName,
  className = '',
}: TravelStatusBadgeProps) {
  const getStatusConfig = () => {
    if (travelStatus === 'couple') {
      return {
        label: partnerName ? `Couple: ${partnerName}` : 'Couple',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-300',
      };
    }

    // Solo travelers - need gender
    if (travelStatus === 'solo') {
      if (gender === 'Male') {
        return {
          label: 'Solo Male',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-300',
        };
      }
      if (gender === 'Female') {
        return {
          label: 'Solo Female',
          bgColor: 'bg-pink-100',
          textColor: 'text-pink-800',
          borderColor: 'border-pink-300',
        };
      }
    }

    return {
      label: 'Status Unknown',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      borderColor: 'border-gray-300',
    };
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      {config.label}
    </span>
  );
}
