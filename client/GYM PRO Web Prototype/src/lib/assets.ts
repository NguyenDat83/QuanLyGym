export const gymPhoto = "https://images.unsplash.com/photo-1597076537061-a6b58163aa45?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBneW0lMjBkdW1iYmVsbHMlMjB3ZWlnaHRzJTIwaW50ZXJpb3IlMjBubyUyMHBlb3BsZXxlbnwxfHx8fDE3OTAzMjA2MDl8MA&ixlib=rb-4.1.0&q=80&w=1080";

export const avatar = "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=160&q=80";

export const trainerPhotos = [
  "https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80",
];

export const photoOf = (id: string) => trainerPhotos[parseInt(id.slice(-2), 16) % trainerPhotos.length];

export const memberAvatar = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80";
