#!/usr/bin/env python3
"""Poke Mart: a simple terminal shop game."""

import sys

SHOP_ITEMS = [
    {"name": "Poke Ball", "price": 200, "sell": 100},
    {"name": "Great Ball", "price": 600, "sell": 300},
    {"name": "Ultra Ball", "price": 1200, "sell": 600},
    {"name": "Potion", "price": 300, "sell": 150},
    {"name": "Super Potion", "price": 700, "sell": 350},
    {"name": "Revive", "price": 1500, "sell": 750},
    {"name": "Antidote", "price": 100, "sell": 50},
    {"name": "Escape Rope", "price": 550, "sell": 275},
    {"name": "Repel", "price": 350, "sell": 175},
    {"name": "Oran Berry", "price": 150, "sell": 75},
]

STARTING_MONEY = 3000


class Player:
    def __init__(self, money=STARTING_MONEY):
        self.money = money
        self.bag = {}

    def add_item(self, name, quantity=1):
        self.bag[name] = self.bag.get(name, 0) + quantity

    def remove_item(self, name, quantity=1):
        self.bag[name] -= quantity
        if self.bag[name] <= 0:
            del self.bag[name]


def find_item(name):
    for item in SHOP_ITEMS:
        if item["name"].lower() == name.lower():
            return item
    return None


def print_shop():
    print("\n=== Poke Mart ===")
    for i, item in enumerate(SHOP_ITEMS, start=1):
        print(f"{i:2}. {item['name']:<14} Buy: {item['price']:>5}  Sell: {item['sell']:>5}")


def print_bag(player):
    print(f"\nMoney: {player.money}")
    if not player.bag:
        print("Bag is empty.")
        return
    print("Bag:")
    for name, qty in player.bag.items():
        print(f"  {name} x{qty}")


def resolve_item_arg(arg):
    if arg.isdigit():
        idx = int(arg) - 1
        if 0 <= idx < len(SHOP_ITEMS):
            return SHOP_ITEMS[idx]
        return None
    return find_item(arg)


def buy(player, name, quantity):
    item = resolve_item_arg(name)
    if item is None:
        print(f"No such item: {name}")
        return
    if quantity <= 0:
        print("Quantity must be positive.")
        return
    cost = item["price"] * quantity
    if cost > player.money:
        print(f"Not enough money. {item['name']} x{quantity} costs {cost}, you have {player.money}.")
        return
    player.money -= cost
    player.add_item(item["name"], quantity)
    print(f"Bought {item['name']} x{quantity} for {cost}. Money left: {player.money}")


def sell(player, name, quantity):
    item = resolve_item_arg(name)
    if item is None:
        print(f"No such item: {name}")
        return
    if quantity <= 0:
        print("Quantity must be positive.")
        return
    owned = player.bag.get(item["name"], 0)
    if owned < quantity:
        print(f"You only have {owned} {item['name']}(s).")
        return
    revenue = item["sell"] * quantity
    player.remove_item(item["name"], quantity)
    player.money += revenue
    print(f"Sold {item['name']} x{quantity} for {revenue}. Money: {player.money}")


HELP_TEXT = """Commands:
  shop                  Show items for sale
  bag                    Show your money and inventory
  buy <item|#> [qty]     Buy an item (default qty 1)
  sell <item|#> [qty]    Sell an item (default qty 1)
  help                    Show this help message
  quit                    Leave the Poke Mart
"""


def run():
    player = Player()
    print("Welcome to the Poke Mart!")
    print(f"You have {player.money} money to spend.")
    print_shop()
    print(HELP_TEXT)

    while True:
        try:
            raw = input("> ").strip()
        except EOFError:
            break
        if not raw:
            continue

        parts = raw.split()
        cmd = parts[0].lower()

        if cmd in ("quit", "exit"):
            print("Thanks for visiting the Poke Mart. Goodbye!")
            break
        elif cmd == "shop":
            print_shop()
        elif cmd == "bag":
            print_bag(player)
        elif cmd == "help":
            print(HELP_TEXT)
        elif cmd == "buy":
            if len(parts) < 2:
                print("Usage: buy <item|#> [qty]")
                continue
            if len(parts) > 2 and parts[-1].isdigit():
                qty = int(parts[-1])
                item_name = " ".join(parts[1:-1])
            else:
                qty = 1
                item_name = " ".join(parts[1:])
            buy(player, item_name, qty)
        elif cmd == "sell":
            if len(parts) < 2:
                print("Usage: sell <item|#> [qty]")
                continue
            if len(parts) > 2 and parts[-1].isdigit():
                qty = int(parts[-1])
                item_name = " ".join(parts[1:-1])
            else:
                qty = 1
                item_name = " ".join(parts[1:])
            sell(player, item_name, qty)
        else:
            print(f"Unknown command: {cmd}. Type 'help' for a list of commands.")


if __name__ == "__main__":
    sys.exit(run())
