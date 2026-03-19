import { Sofa, UtensilsCrossed, Bath, BedDouble } from "lucide-react";
import { useTranslation } from "react-i18next";

interface RoomSelectorProps {
  selectedRoom: string;
  onSelectRoom: (room: string) => void;
}

const rooms = [
  { id: "living-room", nameHe: "סלון", nameEn: "Living Room", icon: Sofa, color: "bg-blue-500" },
  { id: "kitchen", nameHe: "מטבח", nameEn: "Kitchen", icon: UtensilsCrossed, color: "bg-green-500" },
  { id: "bathroom", nameHe: "חדר אמבטיה", nameEn: "Bathroom", icon: Bath, color: "bg-purple-500" },
  { id: "bedroom", nameHe: "חדר שינה", nameEn: "Bedroom", icon: BedDouble, color: "bg-pink-500" },
];

export default function RoomSelector({
  selectedRoom,
  onSelectRoom,
}: RoomSelectorProps) {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" dir={isEnglish ? "ltr" : "rtl"}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {isEnglish ? "Choose a room" : "בחר חדר"}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rooms.map((room) => {
          const Icon = room.icon;
          const isSelected = selectedRoom === room.id;
          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`p-4 rounded-xl transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-lg scale-105"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <div
                className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                  isSelected ? "bg-white/20" : room.color
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${
                    isSelected ? "text-white" : "text-white"
                  }`}
                />
              </div>
              <p className="text-sm font-medium">{isEnglish ? room.nameEn : room.nameHe}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
