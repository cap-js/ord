using { demo } from '../db/schema';

service OrderService {
    entity Orders as projection on demo.Orders;
    event OrderChanged { ID: UUID; }
}

@DataIntegration.dataProduct.type: 'primary'
service OrderDataProduct {
    entity Orders as projection on demo.Orders;
    entity OrderItems as projection on demo.OrderItems;
}
