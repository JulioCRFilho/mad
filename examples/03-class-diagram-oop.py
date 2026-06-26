//@::classDiagram

//@User
class User:
    //@User1:__init__ method
    def __init__(self, name, email):
        self.name = name
        self.email = email
    
    //@User1.1:place_order method
    def place_order(self, items):
        return Order(self, items)
    
    //@User1.2:make_payment method
    def make_payment(self, order):
        return Payment(self, order)

//@Order
class Order:
    //@Order1:__init__ method
    def __init__(self, user, items):
        self.user = user
        self.items = items
        self.total = sum(item.price for item in items)
    
    //@Order1.1:calculate_total method
    def calculate_total(self):
        return self.total
    
    //@Order1.2:add_item method
    def add_item(self, item):
        self.items.append(item)
        self.total += item.price

//@Payment
class Payment:
    //@Payment1:__init__ method
    def __init__(self, user, order):
        self.user = user
        self.order = order
        self.status = "pending"
    
    //@Payment1.1:process method
    def process(self):
        self.status = "completed"
        return True
    
    //@Payment1.2:refund method
    def refund(self):
        self.status = "refunded"