import { PrismaClient, SenderType } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

// Helper to generate random dates in the past
function randomPastDate(daysAgo: number): Date {
    const now = new Date();
    const offset = Math.floor(Math.random() * daysAgo);
    now.setDate(now.getDate() - offset);
    now.setHours(Math.floor(Math.random() * 12) + 8);
    now.setMinutes(Math.floor(Math.random() * 60));
    return now;
}

function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

// Guest message templates (conversations about bookings)
const guestConversations = [
    {
        guestMessages: [
            "Hi! I'm really excited about our upcoming stay. What's the earliest we can check in?",
            "That works perfectly! Also, do we need to bring our own firewood or can we buy it there?",
            "Great, we'll grab some when we arrive. One more question - are the showers clean and have hot water?",
            "Awesome, can't wait! See you soon!"
        ],
        staffReplies: [
            "Hello! We're excited to have you! Check-in officially starts at 3pm, but if your site is ready earlier, we can sometimes accommodate early arrivals around 1pm. Just check with the office when you get here!",
            "We sell bundles of seasoned firewood at the camp store for $8 each. Most guests find 2-3 bundles are enough for an evening campfire.",
            "Absolutely! Our bathhouses are cleaned twice daily and have plenty of hot water. We also have private family bathrooms available if you prefer.",
        ]
    },
    {
        guestMessages: [
            "Hello, I need to change our reservation dates. Is that possible?",
            "We'd like to move from the 15th to the 22nd instead. Same number of nights.",
            "That would be perfect! Thank you so much for the help.",
        ],
        staffReplies: [
            "Hi there! Yes, we can usually accommodate date changes depending on availability. What dates were you looking at?",
            "Let me check... Great news! That site is available for the 22nd. I've updated your reservation. You'll receive a confirmation email shortly.",
        ]
    },
    {
        guestMessages: [
            "We're about 30 minutes away. Just wanted to let you know we're a bit behind schedule.",
            "Just pulled in! Where do we go to check in?",
            "Found it, thanks! Beautiful place you have here.",
        ],
        staffReplies: [
            "No problem at all! The office is open until 9pm so take your time. Safe travels!",
            "Head to the main office - it's the first building on your right after the entrance gate. There's guest parking right out front. Welcome!",
        ]
    },
    {
        guestMessages: [
            "Is there wifi available at the campsites?",
            "What about near the lodge? I have a work call I need to take.",
            "Perfect, I'll plan to take my call there. Thanks!",
        ],
        staffReplies: [
            "We have wifi coverage in the common areas - the lodge, camp store, and around the pool. The campsites are intentionally unplugged for a more peaceful experience, but you can get a signal at your car if needed!",
            "Yes! The lodge has excellent wifi and there are quiet spots you can use for calls. There's also a small business center with a desk if you need privacy.",
        ]
    },
    {
        guestMessages: [
            "Hi, we're at site 42 and there seems to be an issue with the electrical hookup. Our 30amp isn't connecting properly.",
            "It looks like the outlet might be damaged. There's some visible wear on the contacts.",
            "Thank you! We appreciate the quick response.",
        ],
        staffReplies: [
            "Sorry to hear that! Can you describe what's happening? Is the breaker tripping or is there no power at all?",
            "I'm sending our maintenance team over right now. If we can't fix it quickly, we'll move you to another site at no extra charge. Sorry for the inconvenience!",
        ]
    },
    {
        guestMessages: [
            "Do you allow dogs? I see pet-friendly listed but wanted to confirm.",
            "She's a golden retriever, about 65 lbs. Very well behaved!",
            "Wonderful! She'll love it. See you next week!",
        ],
        staffReplies: [
            "Yes, we love dogs here! We just ask that they stay on leash in common areas and that you clean up after them. What kind of pup will be joining you?",
            "Perfect! Golden retrievers are always welcome. We even have a dedicated off-leash dog park near the back of the property where she can run and play!",
        ]
    },
    {
        guestMessages: [
            "Quick question - is there a grocery store nearby?",
            "How about restaurants? We might want to take a night off from cooking.",
            "Great info, thanks! We're really looking forward to our stay.",
        ],
        staffReplies: [
            "There's a small general store about 5 miles east that has basics. For a full grocery store, you'll want to head into town - about 15 miles. Our camp store also stocks essentials, snacks, and ice!",
            "Definitely! There's a great BBQ place about 10 minutes away, and the town has several nice restaurants. I can give you a list of local favorites at check-in!",
        ]
    },
    {
        guestMessages: [
            "We had such an amazing time! Already want to book for next year.",
            "What dates would you recommend? We want to catch good weather but avoid crowds.",
            "Perfect, we'll book for mid-September then. Thanks for everything - your staff was wonderful!",
        ],
        staffReplies: [
            "So glad to hear that! We'd love to have you back. Let me know what dates you're thinking and I can check availability.",
            "Mid-September is fantastic - the leaves are starting to turn, weather is still warm during the day, and it's much less crowded than summer. Plus, our rates are a bit lower!",
        ]
    },
];

// Staff internal chat messages
const staffChatMessages = [
    { firstName: "Sarah", lastName: "Manager", message: "Good morning team! Quick update - we're at 85% capacity this weekend. Make sure all sites are ready by noon." },
    { firstName: "Mike", lastName: "Reception", message: "Morning! I've got check-ins starting at 2pm. Will the pool be open today? Guest is asking." },
    { firstName: "Bob", lastName: "Fixit", message: "Pool is good to go. Finished the filter maintenance this morning. Heating up now." },
    { firstName: "Sarah", lastName: "Manager", message: "Perfect timing Bob! Mike, yes pool opens at 10am. Let guests know towels are available at the office." },
    { firstName: "Mike", lastName: "Reception", message: "Will do. Also, site P3 guest called - they need an early checkout tomorrow, leaving by 7am." },
    { firstName: "Sarah", lastName: "Manager", message: "That's fine. Make a note so housekeeping knows to prioritize P3 in the morning." },
    { firstName: "Bob", lastName: "Fixit", message: "Heads up - I noticed the water pressure is low at the T section. Going to check the main valve." },
    { firstName: "Mike", lastName: "Reception", message: "Thanks for the heads up. I'll let any tent site check-ins know there might be a brief interruption." },
    { firstName: "Sarah", lastName: "Manager", message: "Good communication everyone. Bob, let us know when water is back to normal." },
    { firstName: "Bob", lastName: "Fixit", message: "Found the issue - minor leak at the junction. Fixed now, pressure should be back to normal in about 10 min." },
    { firstName: "Sarah", lastName: "Manager", message: "Great work! Did we get the new firewood delivery scheduled?" },
    { firstName: "Mike", lastName: "Reception", message: "Yes, coming Thursday morning. We're down to about 20 bundles so should be fine until then." },
    { firstName: "Bob", lastName: "Fixit", message: "I'll make sure the storage area is cleared out for the delivery." },
    { firstName: "Sarah", lastName: "Manager", message: "Perfect. Also reminder - staff meeting tomorrow at 9am in the lodge. We're going over the holiday weekend plans." },
    { firstName: "Mike", lastName: "Reception", message: "Got it. Should I prep the reservation summary for the meeting?" },
    { firstName: "Sarah", lastName: "Manager", message: "That would be great, thanks Mike! Include the VIP guests list too." },
    { firstName: "Bob", lastName: "Fixit", message: "I'll have the maintenance report ready. Just finished pest control inspection on the cabins - all clear." },
    { firstName: "Mike", lastName: "Reception", message: "Nice! Speaking of cabins, C301 guest wants extra towels. Will drop them off during rounds if that helps." },
    { firstName: "Sarah", lastName: "Manager", message: "That'd be perfect. Thanks for being proactive everyone. Let's make this a great weekend!" },
    { firstName: "Mike", lastName: "Reception", message: "Absolutely! Oh, almost forgot - the Johnson family (site R105) asked about the s'mores kit pricing." },
    { firstName: "Sarah", lastName: "Manager", message: "S'mores kits are $12 and include marshmallows, graham crackers, and chocolate for 4 people. We also have the deluxe kit for $18." },
    { firstName: "Bob", lastName: "Fixit", message: "Going to lunch now. Back in 45 to continue with the propane checks on the RV sites." },
    { firstName: "Sarah", lastName: "Manager", message: "Sounds good. Mike, don't forget to eat too - it's going to be a busy afternoon!" },
    { firstName: "Mike", lastName: "Reception", message: "Ha! Already ordered from the diner. First arrivals just pulled in!" },
];

async function main() {
    console.log('🌱 Seeding Messaging Data...\n');

    // Get the first campground
    const campground = await prisma.campground.findFirst({
        include: {
            reservations: {
                include: {
                    guest: true,
                    site: true
                },
                take: 15,
                where: {
                    status: { in: ['confirmed', 'checked_in', 'checked_out'] }
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!campground) {
        throw new Error('No campground found. Run the main seed first.');
    }

    console.log(`Found campground: ${campground.name}`);

    // Get staff users for internal messages
    const staffUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        take: 5
    });

    if (staffUsers.length < 3) {
        throw new Error('Not enough staff users found. Run the main seed first.');
    }

    console.log(`Found ${staffUsers.length} staff users`);

    // Clear existing messages
    await prisma.message.deleteMany({ where: { campgroundId: campground.id } });
    await prisma.internalMessage.deleteMany();
    await prisma.internalConversationParticipant.deleteMany();
    await prisma.internalConversation.deleteMany();
    console.log('Cleared existing messages\n');

    // ============ SEED GUEST MESSAGES ============
    console.log('Creating guest conversations...');
    let guestMessageCount = 0;

    for (let i = 0; i < Math.min(campground.reservations.length, guestConversations.length); i++) {
        const reservation = campground.reservations[i];
        const conversation = guestConversations[i];

        let currentTime = randomPastDate(7);
        const maxMessages = Math.max(conversation.guestMessages.length, conversation.staffReplies.length);

        for (let j = 0; j < maxMessages; j++) {
            if (j < conversation.guestMessages.length) {
                await prisma.message.create({
                    data: {
                        campgroundId: campground.id,
                        reservationId: reservation.id,
                        guestId: reservation.guestId,
                        senderType: SenderType.guest,
                        content: conversation.guestMessages[j],
                        createdAt: currentTime,
                        readAt: addMinutes(currentTime, Math.floor(Math.random() * 15) + 5)
                    }
                });
                guestMessageCount++;
                currentTime = addMinutes(currentTime, Math.floor(Math.random() * 30) + 10);
            }

            if (j < conversation.staffReplies.length) {
                await prisma.message.create({
                    data: {
                        campgroundId: campground.id,
                        reservationId: reservation.id,
                        guestId: reservation.guestId,
                        senderType: SenderType.staff,
                        content: conversation.staffReplies[j],
                        createdAt: currentTime,
                        readAt: null
                    }
                });
                guestMessageCount++;
                currentTime = addMinutes(currentTime, Math.floor(Math.random() * 60) + 5);
            }
        }

        console.log(`  Created conversation with ${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`);
    }

    console.log(`\n✓ Created ${guestMessageCount} guest messages\n`);

    // ============ SEED INTERNAL STAFF MESSAGES ============
    console.log('Creating internal staff chat...');

    // Create General Channel
    const generalChannel = await prisma.internalConversation.create({
        data: {
            name: "General",
            type: "channel",
            campgroundId: campground.id,
            participants: {
                create: staffUsers.map(u => ({ userId: u.id }))
            }
        }
    });

    const userMap = new Map<string, string>();
    for (const user of staffUsers) {
        userMap.set(`${user.firstName} ${user.lastName}`, user.id);
    }

    let chatTime = new Date();
    chatTime.setHours(7, 30, 0, 0);

    let internalMessageCount = 0;
    for (const msg of staffChatMessages) {
        const userId = userMap.get(`${msg.firstName} ${msg.lastName}`);
        if (!userId) continue;

        await prisma.internalMessage.create({
            data: {
                senderId: userId,
                content: msg.message,
                createdAt: chatTime,
                conversationId: generalChannel.id
            }
        });

        internalMessageCount++;
        chatTime = addMinutes(chatTime, Math.floor(Math.random() * 6) + 2);
    }

    console.log(`✓ Created ${internalMessageCount} internal staff messages\n`);

    // ============ ADD UNREAD MESSAGES ============
    console.log('Adding recent unread guest messages...');

    const recentReservations = campground.reservations.slice(-3);
    const unreadMessages = [
        "Hey, just a quick question - is late checkout available tomorrow?",
        "Hi! Our propane tank is running low. Do you sell refills at the store?",
        "Hello, we noticed a wasp nest near our picnic table. Can someone take a look?",
    ];

    for (let i = 0; i < recentReservations.length && i < unreadMessages.length; i++) {
        const reservation = recentReservations[i];
        await prisma.message.create({
            data: {
                campgroundId: campground.id,
                reservationId: reservation.id,
                guestId: reservation.guestId,
                senderType: SenderType.guest,
                content: unreadMessages[i],
                createdAt: new Date(),
                readAt: null
            }
        });
    }

    console.log(`✓ Added ${recentReservations.length} unread messages\n`);

    console.log('✅ Messaging seed complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   Guest messages: ${guestMessageCount + recentReservations.length}`);
    console.log(`   Internal staff messages: ${internalMessageCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
