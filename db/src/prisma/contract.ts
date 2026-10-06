import { defineContract } from '@prisma/orm-postgres/contract-builder';

export const contract = defineContract({}, ({ field, model, rel }) => {
  const Product = model('Product', {
    fields: {
      id: field.id.uuidv7String(),
      name: field.text(),
      brand: field.text().optional(),
      description: field.text().optional(),
      dateAdded: field.temporal.createdAtString(),
      lastUpdated: field.temporal.updatedAtString(),
    },
  });

  const Store = model('Store', {
    fields: {
      id: field.id.uuidv7String(),
      name: field.text(),
      websiteUrl: field.text(),
      logoPath: field.text().optional(),
    },
  });

  const Offer = model('Offer', {
    fields: {
      id: field.id.uuidv7String(),
      productId: field.uuidString(),
      storeId: field.uuidString(),
      price: field.decimal(),
      lastUpdated: field.temporal.updatedAtString(),
      isActive: field.boolean(),
      lastSeenAt: field.temporal.updatedAtString(),
    },
  });

  return {
    models: {
      Product: Product.relations({
        offers: rel.hasMany(Offer, { by: 'productId' }),
      }),
      Store: Store.relations({
        offers: rel.hasMany(Offer, { by: 'storeId' }),
      }),
      Offer: Offer.relations({
        product: rel.belongsTo(Product, {
          from: 'productId',
          to: 'id',
        }),

        store: rel.belongsTo(Store, {
          from: 'storeId',
          to: 'id',
        }),
      }),
    },
  };
});
