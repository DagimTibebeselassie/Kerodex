export type BuyerGuideStep = {
  id: string;
  title: string;
  short: string;
  checklist: string[];
  warning?: string;
  stateSpecificPlaceholder?: string;
};

export const BUYER_GUIDE_STEPS: BuyerGuideStep[] = [
  {
    id: 'review_listing',
    title: 'Review the listing',
    short: 'Confirm the basics before spending time on the deal.',
    checklist: ['Review photos, price, mileage, VIN, title status, and seller disclosures.', 'Compare the saved market value and similar listings.', 'Write down any missing details to ask the seller.'],
  },
  {
    id: 'message_seller',
    title: 'Message the seller',
    short: 'Keep communication inside Kerodex when possible.',
    checklist: ['Ask if the vehicle is still available.', 'Ask whether the seller has the title and maintenance records.', 'Watch for pressure to move off platform or send money early.'],
    warning: 'Avoid sharing sensitive personal or payment information before you verify the seller, vehicle, and title.',
  },
  {
    id: 'verify_title_ownership',
    title: 'Verify title and ownership',
    short: 'Make sure the seller can legally transfer the vehicle.',
    checklist: ['Ask to see the title or registration in person.', 'Confirm the VIN on the title matches the vehicle VIN.', 'Check for liens, salvage, rebuilt, flood, or other title branding.'],
    warning: 'Kerodex guidance does not prove ownership. Title transfer rules vary by state.',
    stateSpecificPlaceholder: 'State-specific title transfer instructions can be added here later.',
  },
  {
    id: 'schedule_safe_meetup',
    title: 'Schedule a safe meetup',
    short: 'Meet where you can inspect the vehicle calmly and safely.',
    checklist: ['Choose a public place during daylight.', 'Bring another person if possible.', 'Avoid private, isolated, or rushed meetups.'],
    warning: 'Do not bring large amounts of cash to an unverified or unsafe meetup.',
  },
  {
    id: 'inspect_vehicle',
    title: 'Inspect the vehicle',
    short: 'Look for condition issues before discussing final payment.',
    checklist: ['Check exterior, interior, tires, lights, fluids, dashboard warnings, and odometer.', 'Confirm the windshield or door-jamb VIN matches the listing.', 'Test drive only if you feel safe and insured to do so.'],
  },
  {
    id: 'mechanic_inspection',
    title: 'Consider a mechanic inspection',
    short: 'A pre-purchase inspection can catch expensive issues.',
    checklist: ['Ask the seller if an independent inspection is allowed.', 'Use a mechanic you trust when possible.', 'Review inspection findings before agreeing on final price.'],
  },
  {
    id: 'agree_on_price',
    title: 'Agree on price',
    short: 'Confirm the final price and what is included.',
    checklist: ['Use inspection results and market value to negotiate fairly.', 'Confirm whether accessories, records, keys, or extra parts are included.', 'Write down the agreed price before paperwork.'],
  },
  {
    id: 'complete_paperwork',
    title: 'Complete paperwork',
    short: 'Document the transaction clearly.',
    checklist: ['Complete the title transfer and bill of sale if needed.', 'Match names, VIN, mileage, date, and sale price across documents.', 'Keep copies or photos for your records.'],
    warning: 'Kerodex does not provide legal, tax, DMV, or financial advice. Requirements vary by state.',
    stateSpecificPlaceholder: 'Future state-specific DMV paperwork steps can be shown here.',
  },
  {
    id: 'make_payment_safely',
    title: 'Make payment safely',
    short: 'Use payment methods that reduce fraud risk.',
    checklist: ['Avoid gift cards.', 'Avoid crypto.', 'Avoid wire transfers to unknown people.', 'Avoid paying before seeing the car and title.', 'Prefer traceable or safer payment methods.'],
    warning: 'Never send money just to hold a vehicle unless you fully understand the risk and trust the seller.',
  },
  {
    id: 'insurance_registration',
    title: 'Insurance and registration',
    short: 'Plan what happens immediately after purchase.',
    checklist: ['Arrange insurance before driving when required.', 'Understand registration, emissions, taxes, and temporary tag requirements.', 'Keep proof of sale and title documents accessible.'],
    stateSpecificPlaceholder: 'Insurance and registration instructions can vary by state and can be expanded later.',
  },
  {
    id: 'complete_purchase',
    title: 'Complete purchase',
    short: 'Wrap up the guide once the deal is finished.',
    checklist: ['Confirm you have keys, documents, and seller contact information.', 'Save copies of payment and paperwork.', 'Mark this guide complete when the purchase is finished.'],
  },
];

export const BUYER_GUIDE_DISCLAIMER =
  'Kerodex provides general guidance only and does not provide legal, tax, DMV, or financial advice. Requirements vary by state.';
