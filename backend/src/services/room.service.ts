import { pgPool } from '../config/database';

export interface Room {
  id: string;
  name: string;
  price_per_night: number;
  capacity: number;
  location: string;
  country: string;
  created_at: Date;
}

export interface RoomWithEmoji extends Omit<Room, 'price_per_night' | 'created_at'> {
  price: number;
  emoji: string;
}

export class RoomService {
  static memoryRooms: Room[] = [
    {
      id: 'room1',
      name: 'Conference Room A',
      price_per_night: 150,
      capacity: 10,
      location: 'New York',
      country: 'USA',
      created_at: new Date()
    },
    {
      id: 'room2',
      name: 'Office Suite',
      price_per_night: 200,
      capacity: 4,
      location: 'San Francisco',
      country: 'USA',
      created_at: new Date()
    },
    {
      id: 'room3',
      name: 'Meeting Hall',
      price_per_night: 300,
      capacity: 30,
      location: 'London',
      country: 'UK',
      created_at: new Date()
    }
  ];
  EMOJI_MAP: Record<string, string> = {
  'King': '👑',
  'Suite': '✨',
  'Studio': '🎨',
  'Deluxe': '💎',
  'Luxury': '🌟',
  'Penthouse': '🏰',
  'Bungalow': '🏝️',
  'Villa': '🏡',
  'Apartment': '🏢',
  'Cottage': '🏠',
  'Loft': '🎭',
  'Home': '🏘️',
  'Chalet': '⛺',
  'Cabin': '🪵',
  'Retreat': '🧘',
  'Cozy': '🔥',
  'Harbor': '⛵',
  'Beach': '🏖️',
  'Ocean': '🌊',
  'Seaside': '🌅',
  'Garden': '🌸',
  'Historic': '🏛️',
  'Modern': '🏗️',
  'Designer': '🎨',
  'Classic': '🎼',
  'Boutique': '🛍️',
  'Central': '🌍',
  'Beachfront': '🏄',
  'Skyline': '🌆',
  'View': '🔭',
  'River': '🌊',
  'Mountain': '⛰️',
  'Alpine': '🏔️',
  'Ski': '⛷️',
  'Ryokan': '⛩️',
  'Minimalist': '⚫',
  'Romantic': '💕',
  'Couple': '👫',
  'Family': '👨‍👩‍👧‍👦',
  'Budget': '💰',
  'Economy': '🚗',
  'Outback': '🦘',
  'Rio': '🎉',
  'Samba': '🎵',
  'Bayfront': '🚤',
  'Copacabana': '🎪',
  'Townhouse': '🏠',
  'Canary': '🦅',
  'Wharf': '🏭',
  'Design': '🖼️',
  'Terrace': '🌳',
  'Ski-in': '🎿',
  'Building': '🏗️',
  'Conference': '🏢',
  'Office': '💼',
  'Meeting': '👥',
  'default': '🏨',
  };

  /** Get all rooms with emoji icons */
  async getAllRooms(): Promise<RoomWithEmoji[]> {
    const skipDb = process.env.SKIP_DB === '1';
    const rows: any[] = skipDb
      ? RoomService.memoryRooms
      : (await pgPool.query(`
          SELECT id, name, price_per_night, location, capacity, country 
          FROM rooms 
          ORDER BY location
        `)).rows;

    return rows.map((room: any) => {
      let emoji = '🏨';
      
      // Find matching emoji
      for (const [keyword, emojiIcon] of Object.entries(this.EMOJI_MAP)) {
        if (room.name.includes(keyword)) {
          emoji = emojiIcon;
          break;
        }
      }

      return {
        id: room.id,
        name: room.name,
        price: Number(room.price_per_night),
        location: room.location,
        capacity: room.capacity,
        emoji,
        country: room.country || 'Unknown',
      };
    });
  }

  /** Get room by ID */
  async getRoomById(roomId: string): Promise<Room> {
    const skipDb = process.env.SKIP_DB === '1';
    if (skipDb) {
      const found = RoomService.memoryRooms.find(r => r.id === roomId);
      if (!found) throw new Error('Room not found');
      return found;
    }

    const result = await pgPool.query(
      'SELECT * FROM rooms WHERE id = $1',
      [roomId]
    );

    if (result.rows.length === 0) {
      throw new Error('Room not found');
    }

    return result.rows[0];
  }
}

export const roomService = new RoomService();
